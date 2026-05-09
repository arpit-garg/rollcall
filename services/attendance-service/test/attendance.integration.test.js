import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import { once } from "node:events";
import pg from "pg";
import jwt from "jsonwebtoken";
import { Client } from "minio";
import { createClient } from "redis";
import {
  resolveDatabaseUrl,
  resolveMinioEndpoint,
  resolveRedisUrl
} from "../../test-support/connectionStrings.mjs";

process.env.ATTENDANCE_SERVICE_PORT = "0";
process.env.DATABASE_URL = resolveDatabaseUrl();
process.env.REDIS_URL = resolveRedisUrl(14);
process.env.JWT_SECRET = process.env.JWT_SECRET || "change-me-access-secret";
process.env.ML_SERVICE_URL = process.env.ML_SERVICE_URL || "http://127.0.0.1:8000";
process.env.ENABLE_DEMO_RESOLUTION = "true";
process.env.MAX_ATTEMPTS_PER_WINDOW = "3";
process.env.MINIO_ENDPOINT = resolveMinioEndpoint();
process.env.MINIO_ACCESS_KEY = process.env.MINIO_ACCESS_KEY || "minioadmin";
process.env.MINIO_SECRET_KEY = process.env.MINIO_SECRET_KEY || "minioadmin";
process.env.MINIO_BUCKET = process.env.MINIO_BUCKET || "face-templates";

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});
const redis = createClient({
  url: process.env.REDIS_URL
});
const minio = new Client({
  endPoint: process.env.MINIO_ENDPOINT.split(":")[0],
  port: Number(process.env.MINIO_ENDPOINT.split(":")[1] || "9000"),
  useSSL: false,
  accessKey: process.env.MINIO_ACCESS_KEY,
  secretKey: process.env.MINIO_SECRET_KEY
});

const { createApp } = await import("../src/app.js");
const { closePool } = await import("../src/config/db.js");
const { closeRedisClient } = await import("../src/config/redis.js");
const { getVerificationQueueStatus } = await import("../src/services/verificationQueue.js");
const {
  startVerificationWorker,
  stopVerificationWorker
} = await import("../src/services/verificationQueue.js");

const app = createApp();
const server = app.listen(0);

await once(server, "listening");
startVerificationWorker();

const port = server.address().port;
const baseUrl = `http://127.0.0.1:${port}`;
const hostelId = "0f68b6d1-a7cf-47cf-b23e-7e4ff6ca58a4";
const studentId = "8f71928b-74d0-4dbb-b30a-1e5da85a20fd";
const wardenId = "54c1feaf-7bb9-4cc7-ac54-f1ed08dcb22c";

function createToken(userId, role) {
  return jwt.sign(
    {
      sub: userId,
      role,
      hostelId
    },
    process.env.JWT_SECRET,
    { expiresIn: "15m" }
  );
}

const studentAuthHeader = {
  Authorization: `Bearer ${createToken(studentId, "student")}`
};
const wardenAuthHeader = {
  Authorization: `Bearer ${createToken(wardenId, "warden")}`
};

async function jsonRequest(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  return {
    status: response.status,
    json: text ? JSON.parse(text) : null
  };
}

async function createWindowForTests() {
  const opensAt = new Date(Date.now() - 60_000).toISOString();
  const closesAt = new Date(Date.now() + 30 * 60_000).toISOString();

  const response = await jsonRequest(`${baseUrl}/api/v1/windows`, {
    method: "POST",
    headers: {
      ...wardenAuthHeader,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      opens_at: opensAt,
      closes_at: closesAt
    })
  });

  assert.equal(response.status, 201);
  return response.json.id;
}

async function listObjectNames(prefix) {
  const objects = [];
  await new Promise((resolve, reject) => {
    const stream = minio.listObjects(process.env.MINIO_BUCKET, prefix, true);
    stream.on("data", (objectInfo) => objects.push(objectInfo.name));
    stream.on("end", resolve);
    stream.on("error", reject);
  });
  return objects;
}

async function waitFor(assertionFn, timeoutMs = 5000, intervalMs = 200) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const result = await assertionFn();

    if (result) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error(`Condition not met within ${timeoutMs}ms`);
}

before(async () => {
  await redis.connect();
  const exists = await minio.bucketExists(process.env.MINIO_BUCKET);
  if (!exists) {
    await minio.makeBucket(process.env.MINIO_BUCKET);
  }
});

beforeEach(async () => {
  await redis.flushDb();
  await pool.query("DELETE FROM overrides");
  await pool.query("DELETE FROM audit_logs");
  await pool.query("DELETE FROM attendance_records");
  await pool.query("DELETE FROM attendance_windows");
  await pool.query(
    `
      INSERT INTO face_templates (student_id, embedding_ref, model_version, is_valid)
      VALUES ($1, 'seed://template', 'demo-facenet-v1', true)
      ON CONFLICT (student_id) DO UPDATE
      SET embedding_ref = EXCLUDED.embedding_ref,
          model_version = EXCLUDED.model_version,
          is_valid = EXCLUDED.is_valid,
          enrolled_at = now()
    `,
    [studentId]
  );

  const existingObjects = await listObjectNames("");
  for (const objectName of existingObjects) {
    await minio.removeObject(process.env.MINIO_BUCKET, objectName);
  }
});

after(async () => {
  await stopVerificationWorker();
  server.close();
  await once(server, "close");
  await redis.quit();
  await closeRedisClient();
  await closePool();
  await pool.end();
});

test("warden can open and list windows from postgres", async () => {
  const windowId = await createWindowForTests();

  const listResponse = await jsonRequest(`${baseUrl}/api/v1/windows`, {
    headers: {
      ...wardenAuthHeader
    }
  });

  assert.equal(listResponse.status, 200);
  assert.equal(listResponse.json.data[0].id, windowId);

  const currentWindowResponse = await jsonRequest(`${baseUrl}/api/v1/attendance/current-window`, {
    headers: {
      ...studentAuthHeader
    }
  });

  assert.equal(currentWindowResponse.status, 200);
  assert.equal(currentWindowResponse.json.data.id, windowId);
});

test("warden cannot open a window with closes_at before opens_at", async () => {
  const opensAt = new Date(Date.now() + 60_000).toISOString();
  const closesAt = new Date(Date.now() - 60_000).toISOString();

  const response = await jsonRequest(`${baseUrl}/api/v1/windows`, {
    method: "POST",
    headers: {
      ...wardenAuthHeader,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      opens_at: opensAt,
      closes_at: closesAt
    })
  });

  assert.equal(response.status, 400);
  assert.equal(response.json.error.code, "VALIDATION_ERROR");
});

test("student submit persists record and duplicate submit returns existing job id", async () => {
  await createWindowForTests();

  const form = new FormData();
  form.append("image", new Blob(["demo-image"], { type: "image/jpeg" }), "capture.jpg");
  form.append("latitude", "28.613939");
  form.append("longitude", "77.209023");
  form.append("idempotency_key", "11111111-1111-4111-8111-111111111111");

  const firstResponse = await fetch(`${baseUrl}/api/v1/attendance/submit`, {
    method: "POST",
    headers: {
      ...studentAuthHeader
    },
    body: form
  });

  const firstBody = await firstResponse.json();
  assert.equal(firstResponse.status, 202);
  assert.equal(firstBody.status, "pending");

  const duplicateForm = new FormData();
  duplicateForm.append("image", new Blob(["demo-image"], { type: "image/jpeg" }), "capture.jpg");
  duplicateForm.append("latitude", "28.613939");
  duplicateForm.append("longitude", "77.209023");
  duplicateForm.append("idempotency_key", "11111111-1111-4111-8111-111111111111");

  const duplicateResponse = await fetch(`${baseUrl}/api/v1/attendance/submit`, {
    method: "POST",
    headers: {
      ...studentAuthHeader
    },
    body: duplicateForm
  });

  const duplicateBody = await duplicateResponse.json();
  assert.equal(duplicateResponse.status, 409);
  assert.equal(duplicateBody.jobId, firstBody.jobId);

  const keys = await redis.keys("attendance:idempotency:*");
  assert.equal(keys.length, 1);

  await waitFor(async () => {
    const tempObjects = await listObjectNames("temp/verification/");
    return tempObjects.length === 0;
  });
});

test("history and job polling reflect resolved attendance records", async () => {
  await createWindowForTests();

  const form = new FormData();
  form.append("image", new Blob(["demo-image"], { type: "image/jpeg" }), "capture.jpg");
  form.append("latitude", "28.613939");
  form.append("longitude", "77.209023");
  form.append("idempotency_key", "22222222-2222-4222-8222-222222222222");

  const submitResponse = await fetch(`${baseUrl}/api/v1/attendance/submit`, {
    method: "POST",
    headers: {
      ...studentAuthHeader
    },
    body: form
  });

  const submitBody = await submitResponse.json();
  assert.equal(submitResponse.status, 202);

  await waitFor(async () => {
    const jobResponse = await jsonRequest(`${baseUrl}/api/v1/attendance/job/${submitBody.jobId}`, {
      headers: {
        ...studentAuthHeader
      }
    });

    return jobResponse.status === 200 && jobResponse.json.status === "verified";
  });

  const jobResponse = await jsonRequest(`${baseUrl}/api/v1/attendance/job/${submitBody.jobId}`, {
    headers: {
      ...studentAuthHeader
    }
  });

  assert.equal(jobResponse.status, 200);
  assert.equal(jobResponse.json.status, "verified");

  const historyResponse = await jsonRequest(`${baseUrl}/api/v1/attendance/my-history`, {
    headers: {
      ...studentAuthHeader
    }
  });

  assert.equal(historyResponse.status, 200);
  assert.equal(historyResponse.json.data[0].jobId, submitBody.jobId);
  assert.equal(historyResponse.json.data[0].status, "verified");

  const queueStatus = await getVerificationQueueStatus();
  assert.equal(queueStatus.workerActive, true);
  assert.ok(queueStatus.processedJobs >= 1);
});

test("enrollment stores template ref in minio and cleans temp object", async () => {
  const form = new FormData();
  form.append("image", new Blob(["enrollment-image"], { type: "image/jpeg" }), "enroll.jpg");

  const response = await fetch(`${baseUrl}/api/v1/enrollment/face`, {
    method: "POST",
    headers: {
      ...studentAuthHeader
    },
    body: form
  });

  const body = await response.json();
  assert.equal(response.status, 202);
  assert.equal(body.status, "processing");

  await waitFor(async () => {
    const statusResponse = await jsonRequest(`${baseUrl}/api/v1/enrollment/status`, {
      headers: {
        ...studentAuthHeader
      }
    });

    return statusResponse.status === 200 && statusResponse.json.status === "enrolled";
  });

  const statusResponse = await jsonRequest(`${baseUrl}/api/v1/enrollment/status`, {
    headers: {
      ...studentAuthHeader
    }
  });

  assert.equal(statusResponse.status, 200);
  assert.equal(statusResponse.json.status, "enrolled");

  const { rows } = await pool.query(
    "SELECT embedding_ref, is_valid FROM face_templates WHERE student_id = $1",
    [studentId]
  );

  assert.equal(rows[0].is_valid, true);
  assert.ok(rows[0].embedding_ref.startsWith("templates/"));
  const templateExists = await minio.statObject(process.env.MINIO_BUCKET, rows[0].embedding_ref);
  assert.ok(templateExists);

  await waitFor(async () => {
    const tempObjects = await listObjectNames("temp/enrollment/");
    return tempObjects.length === 0;
  });
});

test("warden override persists override and audit logs", async () => {
  const windowId = await createWindowForTests();

  const form = new FormData();
  form.append("image", new Blob(["demo-image"], { type: "image/jpeg" }), "capture.jpg");
  form.append("latitude", "28.613939");
  form.append("longitude", "77.209023");
  form.append("idempotency_key", "33333333-3333-4333-8333-333333333333");

  const submitResponse = await fetch(`${baseUrl}/api/v1/attendance/submit`, {
    method: "POST",
    headers: {
      ...studentAuthHeader
    },
    body: form
  });

  assert.equal(submitResponse.status, 202);
  await waitFor(async () => {
    const recordsResponse = await jsonRequest(`${baseUrl}/api/v1/windows/${windowId}/records`, {
      headers: {
        ...wardenAuthHeader
      }
    });

    return recordsResponse.status === 200 && recordsResponse.json.data.length > 0;
  });

  const recordsResponse = await jsonRequest(`${baseUrl}/api/v1/windows/${windowId}/records`, {
    headers: {
      ...wardenAuthHeader
    }
  });

  assert.equal(recordsResponse.status, 200);
  const recordId = recordsResponse.json.data[0].id;

  const overrideResponse = await jsonRequest(
    `${baseUrl}/api/v1/attendance/${recordId}/override`,
    {
      method: "POST",
      headers: {
        ...wardenAuthHeader,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        reason: "Student verified in person"
      })
    }
  );

  assert.equal(overrideResponse.status, 200);
  assert.equal(overrideResponse.json.status, "overridden");

  const { rows: overrideRows } = await pool.query(
    "SELECT reason FROM overrides WHERE attendance_record_id = $1",
    [recordId]
  );
  const { rows: auditRows } = await pool.query(
    "SELECT action FROM audit_logs WHERE entity_id = $1 ORDER BY id",
    [recordId]
  );

  assert.equal(overrideRows[0].reason, "Student verified in person");
  assert.ok(auditRows.some((row) => row.action === "ATTENDANCE_OVERRIDE"));
  assert.ok(auditRows.some((row) => row.action === "ATTENDANCE_SUBMITTED"));

  const overridesResponse = await jsonRequest(`${baseUrl}/api/v1/attendance/overrides`, {
    headers: {
      ...wardenAuthHeader
    }
  });

  assert.equal(overridesResponse.status, 200);
  assert.equal(overridesResponse.json.data[0].attendanceRecordId, recordId);
  assert.equal(overridesResponse.json.data[0].studentName, "Aarav Student");
  assert.equal(overridesResponse.json.data[0].wardenName, "Meera Warden");
});
