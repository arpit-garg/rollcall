import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import { once } from "node:events";
import pg from "pg";
import { createClient } from "redis";
import { resolveDatabaseUrl, resolveRedisUrl } from "../../test-support/connectionStrings.mjs";

process.env.AUTH_SERVICE_PORT = "0";
process.env.DATABASE_URL = resolveDatabaseUrl();
process.env.REDIS_URL = resolveRedisUrl(15);
process.env.JWT_SECRET = process.env.JWT_SECRET || "phase2-test-access-secret";
process.env.REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET || "phase2-test-refresh-secret";
process.env.ACCESS_TOKEN_TTL_MINUTES = process.env.ACCESS_TOKEN_TTL_MINUTES || "15";
process.env.REFRESH_TOKEN_TTL_DAYS = process.env.REFRESH_TOKEN_TTL_DAYS || "7";
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

const app = createApp();
const server = app.listen(0);

await once(server, "listening");

const port = server.address().port;
const baseUrl = `http://127.0.0.1:${port}`;

function parseRefreshToken(setCookieHeader) {
  return setCookieHeader
    .find((header) => header.startsWith("refreshToken="))
    .split(";")[0]
    .replace("refreshToken=", "");
}

before(async () => {
  await redis.connect();
});

beforeEach(async () => {
  await redis.flushDb();
  await pool.query("DELETE FROM users WHERE email = 'test_signup@college.edu'");
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

test("login returns access token and refresh cookie for seeded student", async () => {
  const response = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
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
  assert.ok(body.refreshToken);
  assert.equal(body.user.role, "student");
  assert.equal(body.user.hostelId, "0f68b6d1-a7cf-47cf-b23e-7e4ff6ca58a4");
  assert.ok(setCookie.some((header) => header.startsWith("refreshToken=")));
});

test("refresh issues a new access token when session exists in redis", async () => {
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
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      refreshToken
    })
  });

  assert.equal(refreshResponse.status, 200);

  const body = await refreshResponse.json();
  assert.ok(body.accessToken);
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

