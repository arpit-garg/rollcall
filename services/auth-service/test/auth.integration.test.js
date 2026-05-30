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
  await pool.query("DELETE FROM users WHERE email LIKE 'test_%@college.edu'");
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

test("signup successfully registers a new student user and returns access token", async () => {
  const response = await fetch(`${baseUrl}/api/v1/auth/signup`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      name: "Test Signup",
      email: "test_signup@college.edu",
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
      email: "test_signup@college.edu",
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
    email: "test_race@college.edu",
    password: "TestPassword123",
    hostelId: "0f68b6d1-a7cf-47cf-b23e-7e4ff6ca58a4"
  };

  await pool.query(`
    CREATE OR REPLACE FUNCTION test_slow_duplicate_signup()
    RETURNS trigger AS $$
    BEGIN
      IF NEW.email = 'test_race@college.edu' THEN
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
      email: "test_browser_signup@college.edu",
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
