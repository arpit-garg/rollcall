import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import { once } from "node:events";
import pg from "pg";
import { createClient } from "redis";
import { resolveDatabaseUrl, resolveRedisUrl } from "../../test-support/connectionStrings.mjs";

process.env.AUTH_SERVICE_PORT = "0";
process.env.NODE_ENV = "test";
process.env.DATABASE_URL = resolveDatabaseUrl();
process.env.REDIS_URL = resolveRedisUrl(15);
process.env.JWT_SECRET = process.env.JWT_SECRET || "phase2-test-access-secret";
process.env.REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET || "phase2-test-refresh-secret";
process.env.ACCESS_TOKEN_TTL_MINUTES = process.env.ACCESS_TOKEN_TTL_MINUTES || "15";
process.env.REFRESH_TOKEN_TTL = "2h";
process.env.REFRESH_TOKEN_COOKIE_NAME = "auth_refresh_test";
process.env.COOKIE_SECURE = "true";
process.env.CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:5173";

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
const { errorHandler } = await import("../src/middlewares/errorHandler.js");

const app = createApp();
const server = app.listen(0);

await once(server, "listening");

const port = server.address().port;
const baseUrl = `http://127.0.0.1:${port}`;
const refreshCookieName = process.env.REFRESH_TOKEN_COOKIE_NAME;

function parseCookieValue(setCookieHeader, name) {
  return setCookieHeader
    .find((header) => header.startsWith(`${name}=`))
    .split(";")[0]
    .replace(`${name}=`, "");
}

function parseRefreshToken(setCookieHeader) {
  return parseCookieValue(setCookieHeader, refreshCookieName);
}

before(async () => {
  await redis.connect();
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
        DELETE FROM leave_requests
        WHERE parent_id IN (
          SELECT id
          FROM users
          WHERE email LIKE 'test_%@college.edu'
             OR email LIKE 'test_%@nitj.ac.in'
        )
        OR student_id IN (
          SELECT id
          FROM users
          WHERE email LIKE 'test_%@college.edu'
             OR email LIKE 'test_%@nitj.ac.in'
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
          SELECT id
          FROM users
          WHERE email LIKE 'test_%@college.edu'
             OR email LIKE 'test_%@nitj.ac.in'
        );
      END IF;

      IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'notifications'
      ) THEN
        DELETE FROM notifications
        WHERE user_id IN (
          SELECT id
          FROM users
          WHERE email LIKE 'test_%@college.edu'
             OR email LIKE 'test_%@nitj.ac.in'
        );
      END IF;

      IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'parent_students'
      ) THEN
        DELETE FROM parent_students
        WHERE parent_id IN (
          SELECT id
          FROM users
          WHERE email LIKE 'test_%@college.edu'
             OR email LIKE 'test_%@nitj.ac.in'
        )
        OR student_id IN (
          SELECT id
          FROM users
          WHERE email LIKE 'test_%@college.edu'
             OR email LIKE 'test_%@nitj.ac.in'
        );
      END IF;
    END $$;
  `);
  await pool.query("DELETE FROM users WHERE email LIKE 'test_%@college.edu' OR email LIKE 'test_%@nitj.ac.in'");
  await pool.query(`
    DELETE FROM hostels
    WHERE name = 'Test Girls Hostel'
       OR name LIKE 'test-hostel-%'
  `);
});

after(async () => {
  server.close();
  await once(server, "close");
  await redis.quit();
  await closeRedisClient();
  await closePool();
  await pool.end();
});

test("seeded users exist in postgres", async () => {
  const { rows } = await pool.query(
    `
      SELECT email
      FROM users
      WHERE email IN ('student@college.edu', 'warden@college.edu')
      ORDER BY email
    `
  );

  assert.deepEqual(
    rows.map((row) => row.email),
    ["student@college.edu", "warden@college.edu"]
  );
});

test("browser login returns access token and cookie-only refresh token using configured secure cookie", async () => {
  const response = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: process.env.CORS_ORIGIN
    },
    body: JSON.stringify({
      email: "student@college.edu",
      password: "Student@123"
    })
  });

  assert.equal(response.status, 200);

  const body = await response.json();
  const setCookie = response.headers.getSetCookie();

  assert.ok(body.accessToken);
  assert.equal(body.refreshToken, undefined);
  assert.equal(body.user.role, "student");
  assert.equal(body.user.hostelId, "0f68b6d1-a7cf-47cf-b23e-7e4ff6ca58a4");
  assert.ok(
    setCookie.some(
      (header) =>
        header.startsWith(`${refreshCookieName}=`) &&
        header.includes("HttpOnly") &&
        header.includes("Secure")
    )
  );
});

test("refresh rotates the refresh token and revokes the old session", async () => {
  const loginResponse = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      email: "warden@college.edu",
      password: "Warden@123"
    })
  });

  assert.equal(loginResponse.status, 200);

  const refreshToken = parseRefreshToken(loginResponse.headers.getSetCookie());
  const refreshResponse = await fetch(`${baseUrl}/api/v1/auth/refresh`, {
    method: "POST",
    headers: {
      Cookie: `${refreshCookieName}=${refreshToken}`
    }
  });

  assert.equal(refreshResponse.status, 200);

  const body = await refreshResponse.json();
  const rotatedToken = parseRefreshToken(refreshResponse.headers.getSetCookie());

  assert.ok(body.accessToken);
  assert.notEqual(rotatedToken, refreshToken);

  const replayResponse = await fetch(`${baseUrl}/api/v1/auth/refresh`, {
    method: "POST",
    headers: {
      Cookie: `${refreshCookieName}=${refreshToken}`
    }
  });

  assert.equal(replayResponse.status, 401);
});

test("concurrent refresh attempts consume the old session only once", async () => {
  const loginResponse = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      email: "warden@college.edu",
      password: "Warden@123"
    })
  });

  assert.equal(loginResponse.status, 200);

  const refreshToken = parseRefreshToken(loginResponse.headers.getSetCookie());
  const responses = await Promise.all(
    Array.from({ length: 4 }, () =>
      fetch(`${baseUrl}/api/v1/auth/refresh`, {
        method: "POST",
        headers: {
          Cookie: `${refreshCookieName}=${refreshToken}`
        }
      })
    )
  );

  const statuses = responses.map((response) => response.status).sort();

  assert.deepEqual(statuses, [200, 401, 401, 401]);
});

test("refresh sessions use configured ttl and do not include raw tokens in redis keys", async () => {
  const loginResponse = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      email: "student@college.edu",
      password: "Student@123"
    })
  });

  assert.equal(loginResponse.status, 200);

  const refreshToken = parseRefreshToken(loginResponse.headers.getSetCookie());
  const rawKey = `auth:refresh:${refreshToken}`;

  assert.equal(await redis.exists(rawKey), 0);

  const keys = await redis.keys("auth:refresh:*");
  assert.equal(keys.length, 1);
  assert.ok(!keys[0].includes(refreshToken));

  const ttlSeconds = await redis.ttl(keys[0]);
  assert.ok(ttlSeconds > 7100 && ttlSeconds <= 7200);
});

test("logout revokes the refresh session", async () => {
  const loginResponse = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      email: "student@college.edu",
      password: "Student@123"
    })
  });

  assert.equal(loginResponse.status, 200);

  const loginBody = await loginResponse.json();
  const refreshToken = parseRefreshToken(loginResponse.headers.getSetCookie());

  const logoutResponse = await fetch(`${baseUrl}/api/v1/auth/logout`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${loginBody.accessToken}`
    },
    body: JSON.stringify({
      refreshToken
    })
  });

  assert.equal(logoutResponse.status, 204);

  const refreshResponse = await fetch(`${baseUrl}/api/v1/auth/refresh`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      refreshToken
    })
  });

  assert.equal(refreshResponse.status, 401);
  const refreshBody = await refreshResponse.json();
  assert.equal(refreshBody.error.code, "UNAUTHORIZED");
});

test("hostels endpoint returns list of seeded hostels", async () => {
  const response = await fetch(`${baseUrl}/api/v1/auth/hostels`);
  assert.equal(response.status, 200);

  const body = await response.json();
  assert.ok(body.data.length >= 1);
  assert.ok(body.data.some((hostel) => hostel.name === "Main Boys Hostel"));
});

test("student signup requires an NITJ email and rejects inline parent details", async () => {
  const response = await fetch(`${baseUrl}/api/v1/auth/signup`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      name: "Test Wrong Domain",
      email: "test_wrong_domain@college.edu",
      password: "TestPassword123",
      hostelId: "0f68b6d1-a7cf-47cf-b23e-7e4ff6ca58a4",
      roomNumber: "B-112"
    })
  });

  assert.equal(response.status, 400);

  const body = await response.json();
  assert.equal(body.error.code, "VALIDATION_ERROR");
  assert.match(body.error.message, /@nitj\.ac\.in/);

  const inlineParentResponse = await fetch(`${baseUrl}/api/v1/auth/signup`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      name: "Test Inline Parent",
      email: "test_inline_parent@nitj.ac.in",
      password: "TestPassword123",
      hostelId: "0f68b6d1-a7cf-47cf-b23e-7e4ff6ca58a4",
      parentName: "Test Parent",
      parentEmail: "test_parent_guardian@college.edu",
      parentPassword: "ParentPassword123"
    })
  });

  assert.equal(inlineParentResponse.status, 400);

  const inlineParentBody = await inlineParentResponse.json();
  assert.equal(inlineParentBody.error.code, "VALIDATION_ERROR");
  assert.match(inlineParentBody.error.message, /Parent signup/i);
});

test("parent signup creates a linked parent account for a registered student id", async () => {
  const studentResponse = await fetch(`${baseUrl}/api/v1/auth/signup`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      name: "Test Parent Link Student",
      email: "test_parent_link_student@nitj.ac.in",
      password: "TestPassword123",
      hostelId: "0f68b6d1-a7cf-47cf-b23e-7e4ff6ca58a4",
      roomNumber: "B-112"
    })
  });

  assert.equal(studentResponse.status, 201);

  const studentBody = await studentResponse.json();
  const parentResponse = await fetch(`${baseUrl}/api/v1/auth/signup/parent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      name: "Test Parent",
      email: "test_parent_guardian@college.edu",
      password: "ParentPassword123",
      studentId: studentBody.user.id
    })
  });

  assert.equal(parentResponse.status, 201);

  const parentSignupBody = await parentResponse.json();
  assert.ok(parentSignupBody.accessToken);
  assert.equal(parentSignupBody.user.role, "parent");
  assert.equal(parentSignupBody.user.hostelId, "0f68b6d1-a7cf-47cf-b23e-7e4ff6ca58a4");

  const { rows } = await pool.query(
    `
      SELECT
        ps.student_id,
        ps.parent_id,
        parent.email AS parent_email,
        parent.role AS parent_role,
        parent.hostel_id AS parent_hostel_id
      FROM parent_students ps
      INNER JOIN users student ON student.id = ps.student_id
      INNER JOIN users parent ON parent.id = ps.parent_id
      WHERE student.email = $1
      LIMIT 1
    `,
    ["test_parent_link_student@nitj.ac.in"]
  );

  assert.equal(rows.length, 1);
  assert.equal(rows[0].parent_email, "test_parent_guardian@college.edu");
  assert.equal(rows[0].parent_role, "parent");
  assert.equal(rows[0].parent_hostel_id, "0f68b6d1-a7cf-47cf-b23e-7e4ff6ca58a4");

  const parentLoginResponse = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      email: "test_parent_guardian@college.edu",
      password: "ParentPassword123"
    })
  });

  assert.equal(parentLoginResponse.status, 200);

  const parentBody = await parentLoginResponse.json();
  assert.equal(parentBody.user.role, "parent");
  assert.equal(parentBody.user.hostelId, "0f68b6d1-a7cf-47cf-b23e-7e4ff6ca58a4");
});

test("parent signup requires a registered student id", async () => {
  const malformedResponse = await fetch(`${baseUrl}/api/v1/auth/signup/parent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      name: "Test Malformed Parent",
      email: "test_malformed_parent@college.edu",
      password: "ParentPassword123",
      studentId: "not-a-uuid"
    })
  });

  assert.equal(malformedResponse.status, 400);

  const malformedBody = await malformedResponse.json();
  assert.equal(malformedBody.error.code, "VALIDATION_ERROR");
  assert.match(malformedBody.error.message, /registered student ID/i);

  const response = await fetch(`${baseUrl}/api/v1/auth/signup/parent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      name: "Test Unlinked Parent",
      email: "test_unlinked_parent@college.edu",
      password: "ParentPassword123",
      studentId: "f0000000-0000-4000-8000-000000000000"
    })
  });

  assert.equal(response.status, 404);

  const body = await response.json();
  assert.equal(body.error.code, "NOT_FOUND");
  assert.match(body.error.message, /Registered student/i);
});

test("super admins can create hostels and warden accounts from protected endpoints", async () => {
  const testHostelName = "test-hostel-girls";
  try {
    await pool.query(
      `
        INSERT INTO users (id, name, email, password_hash, role, hostel_id, room_number, is_active)
        VALUES (
          'fbc1aa4f-9147-4ec2-9a0f-25e524977f80',
          'Test Super Admin',
          'test_superadmin@college.edu',
          '$2a$10$GtwXiJPyYapRPBoR/Gqkq.D6GwEIxMJB/isVne5CORGS7tnpCKGcW',
          'super_admin',
          NULL,
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
      `
    );

    const loginResponse = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        email: "test_superadmin@college.edu",
        password: "Warden@123"
      })
    });

    assert.equal(loginResponse.status, 200);

    const loginBody = await loginResponse.json();
    assert.equal(loginBody.user.role, "super_admin");

    const createHostelResponse = await fetch(`${baseUrl}/api/v1/auth/admin/hostels`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${loginBody.accessToken}`
      },
      body: JSON.stringify({
        name: testHostelName,
        centerLat: 28.619102,
        centerLng: 77.214812,
        radiusMetres: 225
      })
    });

    assert.equal(createHostelResponse.status, 201);

    const hostelBody = await createHostelResponse.json();
    assert.equal(hostelBody.data.name, testHostelName);
    assert.equal(hostelBody.data.radiusMetres, 225);

    const createWardenResponse = await fetch(`${baseUrl}/api/v1/auth/admin/wardens`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${loginBody.accessToken}`
      },
      body: JSON.stringify({
        name: "Test Girls Hostel Warden",
        email: "test_new_warden@college.edu",
        password: "Warden@123",
        hostelId: hostelBody.data.id
      })
    });

    assert.equal(createWardenResponse.status, 201);

    const wardenBody = await createWardenResponse.json();
    assert.equal(wardenBody.data.role, "warden");
    assert.equal(wardenBody.data.hostelId, hostelBody.data.id);

    const wardenLoginResponse = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        email: "test_new_warden@college.edu",
        password: "Warden@123"
      })
    });

    assert.equal(wardenLoginResponse.status, 200);

    const wardenLoginBody = await wardenLoginResponse.json();
    assert.equal(wardenLoginBody.user.role, "warden");
    assert.equal(wardenLoginBody.user.hostelId, hostelBody.data.id);
  } finally {
    await pool.query("DELETE FROM users WHERE email LIKE 'test_%@college.edu'");
    await pool.query(
      `
        DELETE FROM hostels
        WHERE name = $1
           OR name LIKE 'test-hostel-%'
      `,
      [testHostelName]
    );
  }
});

test("signup successfully registers a new student user and returns access token", async () => {
  const response = await fetch(`${baseUrl}/api/v1/auth/signup`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      name: "Test Signup",
      email: "test_signup@nitj.ac.in",
      password: "TestPassword123",
      hostelId: "0f68b6d1-a7cf-47cf-b23e-7e4ff6ca58a4",
      roomNumber: "C-305"
    })
  });

  assert.equal(response.status, 201);

  const body = await response.json();
  assert.ok(body.accessToken);
  assert.ok(body.refreshToken);
  assert.equal(body.user.name, "Test Signup");
  assert.equal(body.user.role, "student");
  assert.equal(body.user.hostelId, "0f68b6d1-a7cf-47cf-b23e-7e4ff6ca58a4");
  assert.equal(body.user.roomNumber, "C-305");

  // Verify duplication check fails with 409 Conflict
  const duplicateResponse = await fetch(`${baseUrl}/api/v1/auth/signup`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      name: "Test Signup",
      email: "test_signup@nitj.ac.in",
      password: "TestPassword123",
      hostelId: "0f68b6d1-a7cf-47cf-b23e-7e4ff6ca58a4"
    })
  });

  assert.equal(duplicateResponse.status, 409);
  const dupBody = await duplicateResponse.json();
  assert.equal(dupBody.error.code, "EMAIL_CONFLICT");
});

test("signup rejects malformed input without crashing on non-string values", async () => {
  const response = await fetch(`${baseUrl}/api/v1/auth/signup`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      name: 123,
      email: { value: "test_malformed@college.edu" },
      password: ["TestPassword123"],
      hostelId: "0f68b6d1-a7cf-47cf-b23e-7e4ff6ca58a4"
    })
  });

  assert.equal(response.status, 400);

  const body = await response.json();
  assert.equal(body.error.code, "VALIDATION_ERROR");
});

test("duplicate signup race returns conflict instead of internal error", async () => {
  const payload = {
    name: "Test Race",
    email: "test_race@nitj.ac.in",
    password: "TestPassword123",
    hostelId: "0f68b6d1-a7cf-47cf-b23e-7e4ff6ca58a4"
  };

  await pool.query(`
    CREATE OR REPLACE FUNCTION test_slow_duplicate_signup()
    RETURNS trigger AS $$
    BEGIN
      IF NEW.email = 'test_race@nitj.ac.in' THEN
        PERFORM pg_sleep(0.1);
      END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `);
  await pool.query("DROP TRIGGER IF EXISTS test_slow_duplicate_signup_trigger ON users");
  await pool.query(`
    CREATE TRIGGER test_slow_duplicate_signup_trigger
    BEFORE INSERT ON users
    FOR EACH ROW
    EXECUTE FUNCTION test_slow_duplicate_signup()
  `);

  try {
    const responses = await Promise.all(
      [payload, payload].map((body) =>
        fetch(`${baseUrl}/api/v1/auth/signup`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(body)
        })
      )
    );

    const statuses = responses.map((response) => response.status).sort();
    assert.deepEqual(statuses, [201, 409]);
  } finally {
    await pool.query("DROP TRIGGER IF EXISTS test_slow_duplicate_signup_trigger ON users");
    await pool.query("DROP FUNCTION IF EXISTS test_slow_duplicate_signup()");
  }
});

test("production startup rejects predictable or missing auth secrets", async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousJwtSecret = process.env.JWT_SECRET;
  const previousRefreshSecret = process.env.REFRESH_TOKEN_SECRET;

  process.env.NODE_ENV = "production";
  delete process.env.JWT_SECRET;
  process.env.REFRESH_TOKEN_SECRET = "strong-refresh-secret-for-production-tests";

  try {
    await assert.rejects(
      import(`../src/config/env.js?missing-secret=${Date.now()}`),
      /JWT_SECRET must be set to a strong secret/
    );
  } finally {
    process.env.NODE_ENV = previousNodeEnv;

    if (previousJwtSecret === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = previousJwtSecret;
    }

    if (previousRefreshSecret === undefined) {
      delete process.env.REFRESH_TOKEN_SECRET;
    } else {
      process.env.REFRESH_TOKEN_SECRET = previousRefreshSecret;
    }
  }
});

test("browser signup also keeps refresh token out of the response body", async () => {
  const response = await fetch(`${baseUrl}/api/v1/auth/signup`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: process.env.CORS_ORIGIN
    },
    body: JSON.stringify({
      name: "Test Browser Signup",
      email: "test_browser_signup@nitj.ac.in",
      password: "TestPassword123",
      hostelId: "0f68b6d1-a7cf-47cf-b23e-7e4ff6ca58a4"
    })
  });

  assert.equal(response.status, 201);

  const body = await response.json();
  assert.ok(body.accessToken);
  assert.equal(body.refreshToken, undefined);
  assert.ok(
    response.headers.getSetCookie().some((header) => header.startsWith(`${refreshCookieName}=`))
  );
});

test("error handler redacts raw messages for unclassified internal errors", () => {
  const error = new Error("database password leaked in stack detail");
  let statusCode;
  let payload;
  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(body) {
      payload = body;
      return this;
    }
  };

  errorHandler(error, {}, res, () => {});

  assert.equal(statusCode, 500);
  assert.equal(payload.error.code, "INTERNAL_ERROR");
  assert.equal(payload.error.message, "Internal server error");
});

test("login rate limits repeated invalid credentials", async () => {
  const attempts = [];

  for (let index = 0; index < 6; index += 1) {
    attempts.push(
      await fetch(`${baseUrl}/api/v1/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          email: "test_ratelimit@college.edu",
          password: "WrongPassword123"
        })
      })
    );
  }

  assert.equal(attempts.at(-1).status, 429);
  const body = await attempts.at(-1).json();
  assert.equal(body.error.code, "RATE_LIMITED");
});
