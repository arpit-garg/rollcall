import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import http from "node:http";
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
process.env.NODE_ENV = "test";
process.env.DATABASE_URL = resolveDatabaseUrl();
process.env.REDIS_URL = resolveRedisUrl(14);
process.env.JWT_SECRET = process.env.JWT_SECRET || "change-me-access-secret";
process.env.ML_SERVICE_URL = "http://127.0.0.1:8000";
process.env.ML_REQUEST_TIMEOUT_MS = "25";
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
  enqueueVerificationJob,
  startVerificationWorker,
  stopVerificationWorker
} = await import("../src/services/verificationQueue.js");
const { requestAttendanceVerification } = await import("../src/services/mlClient.js");
const {
  completeEnrollment,
  failEnrollmentAttempt,
  getEnrollmentStatus,
  startEnrollment
} = await import("../src/services/enrollmentService.js");
const { runEnrollmentPipeline } = await import("../src/services/pipeline.js");
const { env } = await import("../src/config/env.js");
const {
  authenticateSocketToken,
  initSocketServer
} = await import("../src/services/socketEmitter.js");
const { resolveAttendanceRecord } = await import("../src/services/attendanceService.js");

const app = createApp();
const server = app.listen(0);

await once(server, "listening");
startVerificationWorker();

const port = server.address().port;
const baseUrl = `http://127.0.0.1:${port}`;
const hostelId = "0f68b6d1-a7cf-47cf-b23e-7e4ff6ca58a4";
const otherHostelId = "a5a4bff2-179f-4eb1-8bf0-b8959d8a26bb";
const studentId = "8f71928b-74d0-4dbb-b30a-1e5da85a20fd";
const otherHostelStudentId = "63db7ce4-ea45-4a4f-823c-cb9ac7ef4d3b";
const wardenId = "54c1feaf-7bb9-4cc7-ac54-f1ed08dcb22c";
const otherHostelWardenId = "015ca63a-111a-4f2f-b1e3-2dac3ee22d4e";

function createToken(userId, role, tokenHostelId = hostelId) {
  return jwt.sign(
    {
      sub: userId,
      role,
      hostelId: tokenHostelId
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
const otherHostelWardenAuthHeader = {
  Authorization: `Bearer ${createToken(otherHostelWardenId, "warden", otherHostelId)}`
};
const otherHostelStudentAuthHeader = {
  Authorization: `Bearer ${createToken(otherHostelStudentId, "student", otherHostelId)}`
};

async function jsonRequest(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  return {
    status: response.status,
    json: text ? JSON.parse(text) : null
  };
}

async function createWindowForTests(authHeader = wardenAuthHeader) {
  const opensAt = new Date(Date.now() - 60_000).toISOString();
  const closesAt = new Date(Date.now() + 30 * 60_000).toISOString();

  const response = await jsonRequest(`${baseUrl}/api/v1/windows`, {
    method: "POST",
    headers: {
      ...authHeader,
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

async function insertAttendanceRecord({ windowId, status = "failed", submittedAt = "now()" }) {
  const jobId = randomUUID();
  const { rows } = await pool.query(
    `
      INSERT INTO attendance_records (
        window_id,
        student_id,
        status,
        job_id,
        geo_lat,
        geo_lng,
        geo_verified,
        face_score,
        liveness_score,
        submitted_at,
        resolved_at
      )
      VALUES ($1, $2, $3, $4, 28.613939, 77.209023, true, NULL, NULL, ${submittedAt}, ${status === "pending" ? "NULL" : "now()"})
      RETURNING id, job_id
    `,
    [windowId, studentId, status, jobId]
  );

  return {
    id: rows[0].id,
    jobId: rows[0].job_id
  };
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
  await pool.query(`
    ALTER TABLE face_templates
      ADD COLUMN IF NOT EXISTS enrollment_attempt_id UUID,
      ADD COLUMN IF NOT EXISTS enrollment_status VARCHAR(20) NOT NULL DEFAULT 'idle'
  `);
  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE table_name = 'face_templates'
          AND constraint_name = 'face_templates_enrollment_status_check'
      ) THEN
        ALTER TABLE face_templates
          ADD CONSTRAINT face_templates_enrollment_status_check
          CHECK (enrollment_status IN ('idle', 'processing'));
      END IF;
    END $$;
  `);
  const exists = await minio.bucketExists(process.env.MINIO_BUCKET);
  if (!exists) {
    await minio.makeBucket(process.env.MINIO_BUCKET);
  }
});

beforeEach(async () => {
  await redis.flushDb();
  await pool.query(
    `
      UPDATE users
      SET is_active = true
      WHERE id = ANY($1::uuid[])
    `,
    [[studentId, otherHostelStudentId, wardenId, otherHostelWardenId]]
  );
  await pool.query(
    `
      INSERT INTO users (id, name, email, password_hash, role, hostel_id, room_number, is_active)
      VALUES (
        $1,
        'MBH-F Test Student',
        'mbhf.student@college.edu',
        '$2a$10$KOm/zgc.9aDfkSfgVJLhhuWWKJfy63F/fAAyYyiTDiy3oKdYJJyUW',
        'student',
        $2,
        'F-108',
        true
      )
      ON CONFLICT (email) DO UPDATE
      SET hostel_id = EXCLUDED.hostel_id,
          room_number = EXCLUDED.room_number,
          is_active = EXCLUDED.is_active
    `,
    [otherHostelStudentId, otherHostelId]
  );
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
          enrollment_attempt_id = NULL,
          enrollment_status = 'idle',
          enrolled_at = now()
    `,
    [studentId]
  );
  await pool.query(
    `
      INSERT INTO face_templates (student_id, embedding_ref, model_version, is_valid)
      VALUES ($1, 'seed://mbhf-template', 'demo-facenet-v1', true)
      ON CONFLICT (student_id) DO UPDATE
      SET embedding_ref = EXCLUDED.embedding_ref,
          model_version = EXCLUDED.model_version,
          is_valid = EXCLUDED.is_valid,
          enrollment_attempt_id = NULL,
          enrollment_status = 'idle',
          enrolled_at = now()
    `,
    [otherHostelStudentId]
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

test("student submit accepts MBH-F campus coordinates inside the configured geofence", async () => {
  await createWindowForTests(otherHostelWardenAuthHeader);

  const form = new FormData();
  form.append("image", new Blob(["demo-image"], { type: "image/jpeg" }), "capture.jpg");
  form.append("latitude", "31.39464");
  form.append("longitude", "75.53393");
  form.append("idempotency_key", "12121212-1212-4212-8212-121212121212");

  const response = await fetch(`${baseUrl}/api/v1/attendance/submit`, {
    method: "POST",
    headers: {
      ...otherHostelStudentAuthHeader
    },
    body: form
  });
  const body = await response.json();

  assert.equal(response.status, 202, JSON.stringify(body));
  assert.equal(body.status, "pending");
});

test("student submit includes GPS accuracy tolerance in the geofence decision", async () => {
  await createWindowForTests(otherHostelWardenAuthHeader);

  const noAccuracyForm = new FormData();
  noAccuracyForm.append("image", new Blob(["demo-image"], { type: "image/jpeg" }), "capture.jpg");
  noAccuracyForm.append("latitude", "31.40652");
  noAccuracyForm.append("longitude", "75.5366");
  noAccuracyForm.append("idempotency_key", "14141414-1414-4414-8414-141414141414");

  const noAccuracyResponse = await fetch(`${baseUrl}/api/v1/attendance/submit`, {
    method: "POST",
    headers: {
      ...otherHostelStudentAuthHeader
    },
    body: noAccuracyForm
  });
  const noAccuracyBody = await noAccuracyResponse.json();

  assert.equal(noAccuracyResponse.status, 422);
  assert.equal(noAccuracyBody.error.code, "GEO_OUT_OF_RANGE");

  const form = new FormData();
  form.append("image", new Blob(["demo-image"], { type: "image/jpeg" }), "capture.jpg");
  form.append("latitude", "31.40652");
  form.append("longitude", "75.5366");
  form.append("accuracy_metres", "30");
  form.append("idempotency_key", "13131313-1313-4313-8313-131313131313");

  const response = await fetch(`${baseUrl}/api/v1/attendance/submit`, {
    method: "POST",
    headers: {
      ...otherHostelStudentAuthHeader
    },
    body: form
  });
  const body = await response.json();

  assert.equal(response.status, 202, JSON.stringify(body));
  assert.equal(body.status, "pending");

  const { rows } = await pool.query(
    `
      SELECT metadata
      FROM audit_logs
      WHERE actor_id = $1
        AND action = 'ATTENDANCE_SUBMITTED'
      ORDER BY id DESC
      LIMIT 1
    `,
    [otherHostelStudentId]
  );

  assert.equal(rows[0].metadata.geofence.gpsAccuracyMetres, 30);
  assert.equal(rows[0].metadata.geofence.hostelRadiusMetres, 750);
  assert.equal(rows[0].metadata.geofence.effectiveRadiusMetres, 780);
});

test("student submit rejects GPS accuracy above the accepted mobile threshold", async () => {
  await createWindowForTests(otherHostelWardenAuthHeader);

  const form = new FormData();
  form.append("image", new Blob(["demo-image"], { type: "image/jpeg" }), "capture.jpg");
  form.append("latitude", "31.3996");
  form.append("longitude", "75.5366");
  form.append("accuracy_metres", "31");
  form.append("idempotency_key", "15151515-1515-4515-8515-151515151515");

  const response = await fetch(`${baseUrl}/api/v1/attendance/submit`, {
    method: "POST",
    headers: {
      ...otherHostelStudentAuthHeader
    },
    body: form
  });
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.equal(body.error.code, "VALIDATION_ERROR");
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

  const submitBody = await submitResponse.json();
  assert.equal(submitResponse.status, 202);

  await resolveAttendanceRecord(submitBody.jobId, {
    status: "failed",
    faceScore: null,
    livenessScore: null
  });

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

test("auth rejects forged roles and inactive users instead of trusting token claims", async () => {
  const forgedWardenForStudent = {
    Authorization: `Bearer ${createToken(studentId, "warden")}`
  };

  const forgedResponse = await jsonRequest(`${baseUrl}/api/v1/windows`, {
    headers: forgedWardenForStudent
  });

  assert.equal(forgedResponse.status, 401);

  await pool.query("UPDATE users SET is_active = false WHERE id = $1", [studentId]);

  const inactiveResponse = await jsonRequest(`${baseUrl}/api/v1/attendance/current-window`, {
    headers: studentAuthHeader
  });

  assert.equal(inactiveResponse.status, 401);
});

test("warden cannot invalidate a face template for a student in another hostel", async () => {
  const response = await jsonRequest(`${baseUrl}/api/v1/enrollment/face`, {
    method: "DELETE",
    headers: {
      ...otherHostelWardenAuthHeader,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ studentId })
  });

  assert.equal(response.status, 404);

  const { rows } = await pool.query(
    "SELECT is_valid FROM face_templates WHERE student_id = $1",
    [studentId]
  );
  assert.equal(rows[0].is_valid, true);
});

test("student submit rejects coordinates outside legal latitude and longitude ranges", async () => {
  await createWindowForTests();

  const form = new FormData();
  form.append("image", new Blob(["demo-image"], { type: "image/jpeg" }), "capture.jpg");
  form.append("latitude", "91");
  form.append("longitude", "181");
  form.append("idempotency_key", "44444444-4444-4444-8444-444444444444");

  const response = await fetch(`${baseUrl}/api/v1/attendance/submit`, {
    method: "POST",
    headers: {
      ...studentAuthHeader
    },
    body: form
  });
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.equal(body.error.code, "VALIDATION_ERROR");
});

test("warden opening a window with invalid date strings returns validation error", async () => {
  const response = await jsonRequest(`${baseUrl}/api/v1/windows`, {
    method: "POST",
    headers: {
      ...wardenAuthHeader,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      opens_at: "not-a-date",
      closes_at: "also-not-a-date"
    })
  });

  assert.equal(response.status, 400);
  assert.equal(response.json.error.code, "VALIDATION_ERROR");
});

test("concurrent overlapping windows allow only one winner", async () => {
  const opensAt = new Date(Date.now() - 30_000).toISOString();
  const closesAt = new Date(Date.now() + 15 * 60_000).toISOString();

  const requests = Array.from({ length: 2 }, () =>
    jsonRequest(`${baseUrl}/api/v1/windows`, {
      method: "POST",
      headers: {
        ...wardenAuthHeader,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        opens_at: opensAt,
        closes_at: closesAt
      })
    })
  );

  const statuses = (await Promise.all(requests)).map((response) => response.status).sort();
  assert.deepEqual(statuses, [201, 409]);
});

test("overrides are limited to failed records and duplicate override returns conflict", async () => {
  const windowId = await createWindowForTests();
  const pendingRecord = await insertAttendanceRecord({ windowId, status: "pending" });

  const pendingOverrideResponse = await jsonRequest(
    `${baseUrl}/api/v1/attendance/${pendingRecord.id}/override`,
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

  assert.equal(pendingOverrideResponse.status, 409);

  await resolveAttendanceRecord(pendingRecord.jobId, {
    status: "failed",
    faceScore: null,
    livenessScore: null
  });

  const firstOverrideResponse = await jsonRequest(
    `${baseUrl}/api/v1/attendance/${pendingRecord.id}/override`,
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

  assert.equal(firstOverrideResponse.status, 200);

  const duplicateOverrideResponse = await jsonRequest(
    `${baseUrl}/api/v1/attendance/${pendingRecord.id}/override`,
    {
      method: "POST",
      headers: {
        ...wardenAuthHeader,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        reason: "Duplicate manual confirmation"
      })
    }
  );

  assert.equal(duplicateOverrideResponse.status, 409);
});

test("failed idempotency keys can be retried instead of returning stale failed jobs", async () => {
  const windowId = await createWindowForTests();
  const failedRecord = await insertAttendanceRecord({ windowId, status: "failed" });
  const clientKey = "55555555-5555-4555-8555-555555555555";

  await redis.set(
    `attendance:idempotency:${windowId}:${studentId}:${clientKey}`,
    failedRecord.jobId,
    { EX: 600 }
  );

  const form = new FormData();
  form.append("image", new Blob(["demo-image"], { type: "image/jpeg" }), "capture.jpg");
  form.append("latitude", "28.613939");
  form.append("longitude", "77.209023");
  form.append("idempotency_key", clientKey);

  const response = await fetch(`${baseUrl}/api/v1/attendance/submit`, {
    method: "POST",
    headers: {
      ...studentAuthHeader
    },
    body: form
  });
  const body = await response.json();

  assert.equal(response.status, 202);
  assert.notEqual(body.jobId, failedRecord.jobId);
});

test("ML verification requests time out instead of hanging indefinitely", async () => {
  const originalFetch = globalThis.fetch;

  try {
    globalThis.fetch = async (_url, options) => {
      assert.ok(options.signal);
      return new Promise((_resolve, reject) => {
        options.signal.addEventListener("abort", () => {
          const error = new Error("The operation was aborted");
          error.name = "AbortError";
          reject(error);
        });
      });
    };

    await assert.rejects(
      () =>
        requestAttendanceVerification({
          studentId,
          jobId: randomUUID(),
          imageObjectKey: "temp/verification/test.jpg",
          templateRef: "seed://template"
        }),
      /timed out/i
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("verification queue tracks processing jobs for retry-safe recovery", async () => {
  await stopVerificationWorker();

  await enqueueVerificationJob({
    jobId: randomUUID(),
    studentId,
    imageObjectKey: "temp/verification/retry-safe.jpg",
    templateRef: "seed://template"
  });

  const redisResult = await redis.sendCommand([
    "RPOPLPUSH",
    "attendance:verification:queue",
    "attendance:verification:processing"
  ]);
  assert.ok(redisResult);

  const status = await getVerificationQueueStatus();
  assert.equal(status.pendingJobs, 0);
  assert.equal(status.processingJobs, 1);
});

test("re-enrollment keeps the old template until the latest attempt succeeds", async () => {
  const oldTemplateRef = `templates/${studentId}/old-template.json`;
  await minio.putObject(
    process.env.MINIO_BUCKET,
    oldTemplateRef,
    Buffer.from("old-template"),
    "old-template".length
  );
  await pool.query(
    `
      UPDATE face_templates
      SET embedding_ref = $2,
          model_version = 'facenet-v1',
          is_valid = true,
          enrollment_status = 'idle',
          enrollment_attempt_id = NULL
      WHERE student_id = $1
    `,
    [studentId, oldTemplateRef]
  );

  const staleAttemptId = await startEnrollment(studentId);
  const latestAttemptId = await startEnrollment(studentId);

  const oldObjectStillExists = await minio.statObject(process.env.MINIO_BUCKET, oldTemplateRef);
  assert.ok(oldObjectStillExists);

  await completeEnrollment(studentId, "facenet-v1", `templates/${studentId}/stale.json`, staleAttemptId);

  let { rows } = await pool.query(
    "SELECT embedding_ref, enrollment_status FROM face_templates WHERE student_id = $1",
    [studentId]
  );
  assert.equal(rows[0].embedding_ref, oldTemplateRef);
  assert.equal(rows[0].enrollment_status, "processing");

  await completeEnrollment(studentId, "facenet-v1", `templates/${studentId}/latest.json`, latestAttemptId);

  rows = (
    await pool.query(
      "SELECT embedding_ref, enrollment_status, is_valid FROM face_templates WHERE student_id = $1",
      [studentId]
    )
  ).rows;
  assert.equal(rows[0].embedding_ref, `templates/${studentId}/latest.json`);
  assert.equal(rows[0].enrollment_status, "idle");
  assert.equal(rows[0].is_valid, true);

  const status = await getEnrollmentStatus(studentId);
  assert.equal(status.status, "enrolled");
});

test("failed enrollment attempt clears processing state without deleting a valid template", async () => {
  const oldTemplateRef = `templates/${studentId}/still-valid-template.json`;
  await minio.putObject(
    process.env.MINIO_BUCKET,
    oldTemplateRef,
    Buffer.from("old-template"),
    "old-template".length
  );
  await pool.query(
    `
      UPDATE face_templates
      SET embedding_ref = $2,
          model_version = 'facenet-v1',
          is_valid = true,
          enrollment_status = 'idle',
          enrollment_attempt_id = NULL
      WHERE student_id = $1
    `,
    [studentId, oldTemplateRef]
  );

  const attemptId = await startEnrollment(studentId);
  await failEnrollmentAttempt(studentId, attemptId);

  const { rows } = await pool.query(
    "SELECT embedding_ref, enrollment_status, is_valid FROM face_templates WHERE student_id = $1",
    [studentId]
  );

  assert.equal(rows[0].embedding_ref, oldTemplateRef);
  assert.equal(rows[0].enrollment_status, "idle");
  assert.equal(rows[0].is_valid, true);

  const oldObjectStillExists = await minio.statObject(process.env.MINIO_BUCKET, oldTemplateRef);
  assert.ok(oldObjectStillExists);
});

test("failed ML enrollment response does not create a valid template", async () => {
  const oldTemplateRef = `templates/${studentId}/valid-before-ml-failure.json`;
  await minio.putObject(
    process.env.MINIO_BUCKET,
    oldTemplateRef,
    Buffer.from("old-template"),
    "old-template".length
  );
  await pool.query(
    `
      UPDATE face_templates
      SET embedding_ref = $2,
          model_version = 'facenet-v1',
          is_valid = true,
          enrollment_status = 'idle',
          enrollment_attempt_id = NULL
      WHERE student_id = $1
    `,
    [studentId, oldTemplateRef]
  );

  const originalEnableDemoResolution = env.enableDemoResolution;
  const originalFetch = globalThis.fetch;
  env.enableDemoResolution = false;
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        status: "failed",
        modelVersion: "facenet-v1",
        embeddingRef: ""
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json"
        }
      }
    );

  try {
    const attemptId = await startEnrollment(studentId);
    await runEnrollmentPipeline({
      studentId,
      imageObjectKey: `temp/enrollment/${studentId}/failed-ml.jpg`,
      attemptId
    });
  } finally {
    env.enableDemoResolution = originalEnableDemoResolution;
    globalThis.fetch = originalFetch;
  }

  const { rows } = await pool.query(
    "SELECT embedding_ref, enrollment_status, is_valid FROM face_templates WHERE student_id = $1",
    [studentId]
  );

  assert.equal(rows[0].embedding_ref, oldTemplateRef);
  assert.equal(rows[0].enrollment_status, "idle");
  assert.equal(rows[0].is_valid, true);
});

test("attendance score resolution rejects values outside the accepted 0 to 1 range", async () => {
  const windowId = await createWindowForTests();
  const record = await insertAttendanceRecord({ windowId, status: "pending" });

  await assert.rejects(
    () =>
      resolveAttendanceRecord(record.jobId, {
        status: "verified",
        faceScore: 1.01,
        livenessScore: 0.5
      }),
    /score/i
  );
});

test("socket authentication rejects missing tokens and resolves active users into hostel rooms", async () => {
  assert.equal(await authenticateSocketToken(undefined), null);

  const forgedToken = createToken(studentId, "warden");
  assert.equal(await authenticateSocketToken(forgedToken), null);

  const authenticated = await authenticateSocketToken(createToken(studentId, "student"));
  assert.equal(authenticated.id, studentId);
  assert.equal(authenticated.role, "student");
  assert.equal(authenticated.hostelId, hostelId);

  const socketHttpServer = http.createServer(createApp());
  const io = initSocketServer(socketHttpServer);

  assert.equal(io._nsps.get("/").adapter.rooms.has(`hostel:${hostelId}`), false);

  await new Promise((resolve) => io.close(resolve));
  socketHttpServer.close();
});
