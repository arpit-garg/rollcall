import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
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

const require = createRequire(import.meta.url);
const { io: createSocketClient } = require("../../../admin-dashboard/node_modules/socket.io-client/build/cjs/index.js");

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
const server = http.createServer(app);
const io = initSocketServer(server);
server.listen(0);

await once(server, "listening");
startVerificationWorker();

const port = server.address().port;
const baseUrl = `http://127.0.0.1:${port}`;
const hostelId = "0f68b6d1-a7cf-47cf-b23e-7e4ff6ca58a4";
const otherHostelId = "a5a4bff2-179f-4eb1-8bf0-b8959d8a26bb";
const studentId = "8f71928b-74d0-4dbb-b30a-1e5da85a20fd";
const sameHostelSecondStudentId = "f394f84f-2c92-4c26-bf87-2b4d0fc6ebca";
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
const sameHostelSecondStudentAuthHeader = {
  Authorization: `Bearer ${createToken(sameHostelSecondStudentId, "student")}`
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

async function insertAttendanceRecordForStudent({
  windowId,
  studentId: recordStudentId,
  status = "failed",
  submittedAt = "now()"
}) {
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
    [windowId, recordStudentId, status, jobId]
  );

  return {
    id: rows[0].id,
    jobId: rows[0].job_id
  };
}

async function ensureParentLink({
  parentId = "4f609ba8-4276-4494-8d0d-31ef1a6c7d10",
  parentEmail = "test_parent_guardian@college.edu",
  parentName = "Test Parent Guardian",
  linkedStudentId = studentId,
  linkedHostelId = hostelId
} = {}) {
  await pool.query(
    `
      INSERT INTO users (id, name, email, password_hash, role, hostel_id, room_number, is_active)
      VALUES (
        $1,
        $2,
        $3,
        '$2a$10$KOm/zgc.9aDfkSfgVJLhhuWWKJfy63F/fAAyYyiTDiy3oKdYJJyUW',
        'parent',
        $4,
        NULL,
        true
      )
      ON CONFLICT (email) DO UPDATE
      SET
        name = EXCLUDED.name,
        password_hash = EXCLUDED.password_hash,
        role = EXCLUDED.role,
        hostel_id = EXCLUDED.hostel_id,
        room_number = EXCLUDED.room_number,
        is_active = EXCLUDED.is_active
    `,
    [parentId, parentName, parentEmail, linkedHostelId]
  );

  await pool.query(
    `
      INSERT INTO parent_students (parent_id, student_id)
      VALUES ($1, $2)
      ON CONFLICT (student_id) DO UPDATE
      SET parent_id = EXCLUDED.parent_id
    `,
    [parentId, linkedStudentId]
  );

  return {
    parentId,
    parentEmail
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

async function removeObjectsWithPrefix(prefix) {
  const objectNames = await listObjectNames(prefix);

  for (const objectName of objectNames) {
    await minio.removeObject(process.env.MINIO_BUCKET, objectName);
  }
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

function connectSocket(token) {
  return createSocketClient(baseUrl, {
    auth: {
      token
    },
    transports: ["websocket"],
    forceNew: true,
    reconnection: false
  });
}

async function waitForSocketConnection(socket) {
  if (socket.connected) {
    return;
  }

  await once(socket, "connect");
}

function waitForSocketEvent(socket, eventName, timeoutMs = 1000) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error(`Timed out waiting for ${eventName}`));
    }, timeoutMs);

    function cleanup() {
      clearTimeout(timeout);
      socket.off(eventName, onEvent);
    }

    function onEvent(payload) {
      cleanup();
      resolve(payload);
    }

    socket.on(eventName, onEvent);
  });
}

function assertNoSocketEvent(socket, eventName, timeoutMs = 250) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.off(eventName, onEvent);
      resolve();
    }, timeoutMs);

    function onEvent(payload) {
      clearTimeout(timeout);
      socket.off(eventName, onEvent);
      reject(new Error(`Unexpected ${eventName}: ${JSON.stringify(payload)}`));
    }

    socket.on(eventName, onEvent);
  });
}

before(async () => {
  await redis.connect();
  await pool.query(`
    ALTER TABLE face_templates
      ADD COLUMN IF NOT EXISTS enrollment_attempt_id UUID,
      ADD COLUMN IF NOT EXISTS enrollment_status VARCHAR(20) NOT NULL DEFAULT 'idle'
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS notifications (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id),
      hostel_id UUID NOT NULL REFERENCES hostels(id),
      type VARCHAR(80) NOT NULL,
      title VARCHAR(160) NOT NULL,
      message TEXT NOT NULL,
      entity_type VARCHAR(60),
      entity_id UUID,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      read_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS notifications_user_type_entity_unique
      ON notifications (user_id, type, entity_id)
      WHERE entity_id IS NOT NULL
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS notifications_user_unread_created_at_idx
      ON notifications (user_id, created_at DESC)
      WHERE read_at IS NULL
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
  await pool.query(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'leave_requests'
      ) THEN
        DELETE FROM leave_requests;
      END IF;

      IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'parent_students'
      ) THEN
        DELETE FROM parent_students;
      END IF;

      IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'notifications'
      ) THEN
        DELETE FROM notifications
        WHERE user_id IN (
          SELECT id FROM users WHERE email LIKE 'test_parent_%@college.edu'
        );
      END IF;

      IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'audit_logs'
      ) THEN
        DELETE FROM audit_logs
        WHERE actor_id IN (
          SELECT id FROM users WHERE email LIKE 'test_parent_%@college.edu'
        );
      END IF;
    END $$;
  `);
  await pool.query("DELETE FROM users WHERE email LIKE 'test_parent_%@college.edu'");
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
  await pool.query("DELETE FROM notifications");
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

  await removeObjectsWithPrefix("temp/enrollment/");
  await removeObjectsWithPrefix("temp/verification/");
  await removeObjectsWithPrefix(`templates/${studentId}/`);
  await removeObjectsWithPrefix(`templates/${otherHostelStudentId}/`);
});

after(async () => {
  await stopVerificationWorker();
  await new Promise((resolve) => io.close(resolve));
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

test("warden opening a window preserves the requested opening timestamp", async () => {
  const opensAt = new Date(Date.now() - 45_000).toISOString();
  const closesAt = new Date(Date.now() + 15 * 60_000).toISOString();

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

  assert.equal(response.status, 201, JSON.stringify(response.json));
  assert.equal(new Date(response.json.opens_at).toISOString(), opensAt);
});

test("opening a window notifies connected students in that hostel only", async () => {
  const studentSocket = connectSocket(createToken(studentId, "student"));
  const sameHostelWardenSocket = connectSocket(createToken(wardenId, "warden"));
  const otherHostelStudentSocket = connectSocket(createToken(otherHostelStudentId, "student", otherHostelId));

  try {
    await Promise.all([
      waitForSocketConnection(studentSocket),
      waitForSocketConnection(sameHostelWardenSocket),
      waitForSocketConnection(otherHostelStudentSocket)
    ]);

    const studentNotification = waitForSocketEvent(studentSocket, "attendance:window-opened");
    const wardenNoNotification = assertNoSocketEvent(sameHostelWardenSocket, "attendance:window-opened");
    const otherHostelNoNotification = assertNoSocketEvent(otherHostelStudentSocket, "attendance:window-opened");

    const windowId = await createWindowForTests();
    const payload = await studentNotification;

    assert.equal(payload.id, windowId);
    assert.equal(payload.hostelId, hostelId);
    assert.equal(payload.message, "Attendance window is now open.");

    await Promise.all([wardenNoNotification, otherHostelNoNotification]);
  } finally {
    studentSocket.disconnect();
    sameHostelWardenSocket.disconnect();
    otherHostelStudentSocket.disconnect();
  }
});

test("opening a window creates unread notifications for every active student in the hostel", async () => {
  const windowId = await createWindowForTests();

  const firstStudentResponse = await jsonRequest(`${baseUrl}/api/v1/notifications/unread`, {
    headers: {
      ...studentAuthHeader
    }
  });
  const secondStudentResponse = await jsonRequest(`${baseUrl}/api/v1/notifications/unread`, {
    headers: {
      ...sameHostelSecondStudentAuthHeader
    }
  });
  const otherHostelStudentResponse = await jsonRequest(`${baseUrl}/api/v1/notifications/unread`, {
    headers: {
      ...otherHostelStudentAuthHeader
    }
  });

  assert.equal(firstStudentResponse.status, 200, JSON.stringify(firstStudentResponse.json));
  assert.equal(secondStudentResponse.status, 200, JSON.stringify(secondStudentResponse.json));
  assert.equal(otherHostelStudentResponse.status, 200, JSON.stringify(otherHostelStudentResponse.json));

  assert.equal(firstStudentResponse.json.data.length, 1);
  assert.equal(secondStudentResponse.json.data.length, 1);
  assert.equal(otherHostelStudentResponse.json.data.length, 0);
  assert.equal(firstStudentResponse.json.data[0].type, "attendance_window_opened");
  assert.equal(firstStudentResponse.json.data[0].entityId, windowId);
  assert.equal(firstStudentResponse.json.data[0].metadata.closesAt, firstStudentResponse.json.data[0].closesAt);

  const readResponse = await jsonRequest(
    `${baseUrl}/api/v1/notifications/${firstStudentResponse.json.data[0].id}/read`,
    {
      method: "PATCH",
      headers: {
        ...studentAuthHeader
      }
    }
  );
  const unreadAfterReadResponse = await jsonRequest(`${baseUrl}/api/v1/notifications/unread`, {
    headers: {
      ...studentAuthHeader
    }
  });

  assert.equal(readResponse.status, 200, JSON.stringify(readResponse.json));
  assert.ok(readResponse.json.readAt);
  assert.equal(unreadAfterReadResponse.status, 200, JSON.stringify(unreadAfterReadResponse.json));
  assert.equal(unreadAfterReadResponse.json.data.length, 0);
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

test("student submit rejects and invalidates a missing stored face template", async () => {
  await createWindowForTests();
  await pool.query(
    `
      UPDATE face_templates
      SET embedding_ref = $2,
          model_version = 'facenet-512-v1',
          is_valid = true,
          enrollment_status = 'idle',
          enrollment_attempt_id = NULL
      WHERE student_id = $1
    `,
    [studentId, `templates/${studentId}/missing-for-submit.npy`]
  );

  const form = new FormData();
  form.append("image", new Blob(["demo-image"], { type: "image/jpeg" }), "capture.jpg");
  form.append("latitude", "28.613939");
  form.append("longitude", "77.209023");
  form.append("idempotency_key", "16161616-1616-4616-8616-161616161616");

  const response = await fetch(`${baseUrl}/api/v1/attendance/submit`, {
    method: "POST",
    headers: {
      ...studentAuthHeader
    },
    body: form
  });
  const body = await response.json();

  assert.equal(response.status, 409);
  assert.equal(body.error.code, "TEMPLATE_NOT_ENROLLED");

  const { rows } = await pool.query(
    "SELECT is_valid, model_version FROM face_templates WHERE student_id = $1",
    [studentId]
  );
  assert.equal(rows[0].is_valid, false);
  assert.equal(rows[0].model_version, "failed");
});

test("student submit rejects demo seed templates when real ML verification is enabled", async () => {
  await createWindowForTests();

  const originalEnableDemoResolution = env.enableDemoResolution;
  env.enableDemoResolution = false;

  try {
    const form = new FormData();
    form.append("image", new Blob(["demo-image"], { type: "image/jpeg" }), "capture.jpg");
    form.append("latitude", "28.613939");
    form.append("longitude", "77.209023");
    form.append("idempotency_key", "17171717-1717-4717-8717-171717171717");

    const response = await fetch(`${baseUrl}/api/v1/attendance/submit`, {
      method: "POST",
      headers: {
        ...studentAuthHeader
      },
      body: form
    });
    const body = await response.json();

    assert.equal(response.status, 409, JSON.stringify(body));
    assert.equal(body.error.code, "TEMPLATE_NOT_ENROLLED");
  } finally {
    env.enableDemoResolution = originalEnableDemoResolution;
  }

  const { rows } = await pool.query(
    "SELECT is_valid, model_version FROM face_templates WHERE student_id = $1",
    [studentId]
  );
  assert.equal(rows[0].is_valid, false);
  assert.equal(rows[0].model_version, "failed");
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

test("linked parents can review their child's leave requests", async () => {
  const { parentId } = await ensureParentLink();
  const parentAuthHeader = {
    Authorization: `Bearer ${createToken(parentId, "parent")}`
  };

  const createLeaveResponse = await jsonRequest(`${baseUrl}/api/v1/leaves`, {
    method: "POST",
    headers: {
      ...studentAuthHeader,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      requestedFrom: "2026-06-02",
      requestedTo: "2026-06-04",
      destination: "Ludhiana",
      reason: "Medical appointment and family visit"
    })
  });

  assert.equal(createLeaveResponse.status, 201, JSON.stringify(createLeaveResponse.json));
  assert.equal(createLeaveResponse.json.data.status, "pending");
  assert.equal(createLeaveResponse.json.data.parentId, parentId);

  const parentListResponse = await jsonRequest(`${baseUrl}/api/v1/leaves`, {
    headers: {
      ...parentAuthHeader
    }
  });

  assert.equal(parentListResponse.status, 200, JSON.stringify(parentListResponse.json));
  assert.equal(parentListResponse.json.data.length, 1);
  assert.equal(parentListResponse.json.data[0].studentId, studentId);
  assert.equal(parentListResponse.json.data[0].status, "pending");

  const decisionResponse = await jsonRequest(
    `${baseUrl}/api/v1/leaves/${createLeaveResponse.json.data.id}/decision`,
    {
      method: "PATCH",
      headers: {
        ...parentAuthHeader,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        decision: "approved",
        note: "Approved by parent after call"
      })
    }
  );

  assert.equal(decisionResponse.status, 200, JSON.stringify(decisionResponse.json));
  assert.equal(decisionResponse.json.data.status, "approved");
  assert.equal(decisionResponse.json.data.parentNote, "Approved by parent after call");

  const studentListResponse = await jsonRequest(`${baseUrl}/api/v1/leaves`, {
    headers: {
      ...studentAuthHeader
    }
  });

  assert.equal(studentListResponse.status, 200, JSON.stringify(studentListResponse.json));
  assert.equal(studentListResponse.json.data.length, 1);
  assert.equal(studentListResponse.json.data[0].status, "approved");

  const { rows } = await pool.query(
    "SELECT status, parent_note FROM leave_requests WHERE id = $1",
    [createLeaveResponse.json.data.id]
  );

  assert.equal(rows[0].status, "approved");
  assert.equal(rows[0].parent_note, "Approved by parent after call");
});

test("linked parents can see only their child's attendance history", async () => {
  const { parentId } = await ensureParentLink();
  const parentAuthHeader = {
    Authorization: `Bearer ${createToken(parentId, "parent")}`
  };
  const windowId = await createWindowForTests();

  await insertAttendanceRecordForStudent({
    windowId,
    studentId,
    status: "verified",
    submittedAt: "now() - interval '20 minutes'"
  });
  await insertAttendanceRecordForStudent({
    windowId,
    studentId: sameHostelSecondStudentId,
    status: "failed",
    submittedAt: "now() - interval '10 minutes'"
  });

  const response = await jsonRequest(`${baseUrl}/api/v1/attendance/children`, {
    headers: {
      ...parentAuthHeader
    }
  });

  assert.equal(response.status, 200, JSON.stringify(response.json));
  assert.equal(response.json.data.student.id, studentId);
  assert.equal(response.json.data.summary.verifiedCount, 1);
  assert.equal(response.json.data.summary.failedCount, 0);
  assert.equal(response.json.data.history.length, 1);
  assert.equal(response.json.data.history[0].studentId, studentId);
  assert.equal(response.json.data.history[0].status, "verified");
});

test("wardens can fetch student-wise attendance summaries for their hostel", async () => {
  const windowId = await createWindowForTests();

  await insertAttendanceRecordForStudent({
    windowId,
    studentId,
    status: "verified",
    submittedAt: "now() - interval '15 minutes'"
  });
  await insertAttendanceRecordForStudent({
    windowId,
    studentId: sameHostelSecondStudentId,
    status: "failed",
    submittedAt: "now() - interval '5 minutes'"
  });

  const response = await jsonRequest(`${baseUrl}/api/v1/attendance/students/summary`, {
    headers: {
      ...wardenAuthHeader
    }
  });

  assert.equal(response.status, 200, JSON.stringify(response.json));
  assert.ok(response.json.data.length >= 2);

  const firstStudent = response.json.data.find((record) => record.studentId === studentId);
  const secondStudent = response.json.data.find((record) => record.studentId === sameHostelSecondStudentId);

  assert.ok(firstStudent);
  assert.ok(secondStudent);
  assert.equal(firstStudent.verifiedCount, 1);
  assert.equal(firstStudent.failedCount, 0);
  assert.equal(firstStudent.lastStatus, "verified");
  assert.equal(secondStudent.verifiedCount, 0);
  assert.equal(secondStudent.failedCount, 1);
  assert.equal(secondStudent.lastStatus, "failed");
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

test("enrollment status requires the stored template object to still exist", async () => {
  const missingTemplateRef = `templates/${studentId}/missing-template.npy`;
  await pool.query(
    `
      UPDATE face_templates
      SET embedding_ref = $2,
          model_version = 'facenet-512-v1',
          is_valid = true,
          enrollment_status = 'idle',
          enrollment_attempt_id = NULL
      WHERE student_id = $1
    `,
    [studentId, missingTemplateRef]
  );

  const statusResponse = await jsonRequest(`${baseUrl}/api/v1/enrollment/status`, {
    headers: {
      ...studentAuthHeader
    }
  });

  assert.equal(statusResponse.status, 200);
  assert.equal(statusResponse.json.status, "re_enrollment_required");

  const { rows } = await pool.query(
    "SELECT is_valid, model_version FROM face_templates WHERE student_id = $1",
    [studentId]
  );
  assert.equal(rows[0].is_valid, false);
  assert.equal(rows[0].model_version, "failed");
});

test("enrollment status requires a real template when real ML verification is enabled", async () => {
  const originalEnableDemoResolution = env.enableDemoResolution;
  env.enableDemoResolution = false;

  try {
    const status = await getEnrollmentStatus(studentId);

    assert.equal(status.status, "re_enrollment_required");
  } finally {
    env.enableDemoResolution = originalEnableDemoResolution;
  }

  const { rows } = await pool.query(
    "SELECT is_valid, model_version FROM face_templates WHERE student_id = $1",
    [studentId]
  );
  assert.equal(rows[0].is_valid, false);
  assert.equal(rows[0].model_version, "failed");
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

  const latestTemplateRef = `templates/${studentId}/latest.json`;
  await minio.putObject(
    process.env.MINIO_BUCKET,
    latestTemplateRef,
    Buffer.from("latest-template"),
    "latest-template".length
  );
  await completeEnrollment(studentId, "facenet-v1", latestTemplateRef, latestAttemptId);

  rows = (
    await pool.query(
      "SELECT embedding_ref, enrollment_status, is_valid FROM face_templates WHERE student_id = $1",
      [studentId]
    )
  ).rows;
  assert.equal(rows[0].embedding_ref, latestTemplateRef);
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
