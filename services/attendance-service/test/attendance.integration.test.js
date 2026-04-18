import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import { once } from "node:events";
import pg from "pg";
import jwt from "jsonwebtoken";
import { createClient } from "redis";

process.env.ATTENDANCE_SERVICE_PORT = "0";
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ||
  process.env.DATABASE_URL ||
  "postgresql://postgres:postgres@127.0.0.1:5432/hostel_attendance";
process.env.REDIS_URL =
  process.env.TEST_REDIS_URL || process.env.REDIS_URL || "redis://127.0.0.1:6379/14";
process.env.JWT_SECRET = process.env.JWT_SECRET || "change-me-access-secret";
process.env.ML_SERVICE_URL = process.env.ML_SERVICE_URL || "http://127.0.0.1:8000";
process.env.ENABLE_DEMO_RESOLUTION = "true";
process.env.MAX_ATTEMPTS_PER_WINDOW = "3";

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});
const redis = createClient({
  url: process.env.REDIS_URL
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

before(async () => {
  await redis.connect();
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

  await new Promise((resolve) => setTimeout(resolve, 1700));

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
  await new Promise((resolve) => setTimeout(resolve, 1700));

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
});
