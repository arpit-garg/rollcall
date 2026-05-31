import { createHmac } from "node:crypto";
import bcrypt from "bcryptjs";
import { Router } from "express";
import { env } from "../config/env.js";
import {
  createParentForStudent,
  createUser,
  findParentLinkByStudentId,
  findUserByEmail,
  findUserById,
  listWardens
} from "../repositories/usersRepository.js";
import { pool } from "../config/db.js";
import { getRedisClient } from "../config/redis.js";
import { requireAuth } from "../middlewares/auth.js";
import {
  consumeRefreshSession,
  persistRefreshSession,
  revokeRefreshSession
} from "../services/refreshSessions.js";
import {
  createAccessToken,
  createRefreshToken,
  getRefreshTokenTtlMs,
  verifyRefreshToken
} from "../utils/tokens.js";

const router = Router();
const MAX_FAILED_LOGIN_ATTEMPTS = 5;
const LOGIN_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_RATE_LIMIT_WINDOW_SECONDS = Math.ceil(LOGIN_RATE_LIMIT_WINDOW_MS / 1000);
const LOGIN_RATE_LIMIT_NAMESPACE = "auth:login-failures";
const STUDENT_EMAIL_PATTERN = /^[^\s@]+@nitj\.ac\.in$/i;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function authCookieOptions() {
  return {
    httpOnly: true,
    sameSite: env.cookieSameSite,
    secure: env.cookieSecure,
    maxAge: getRefreshTokenTtlMs()
  };
}

function clearCookieOptions() {
  return {
    httpOnly: true,
    sameSite: env.cookieSameSite,
    secure: env.cookieSecure
  };
}

function validationError(res, message) {
  return res.status(400).json({
    error: {
      code: "VALIDATION_ERROR",
      message,
      retryable: false
    }
  });
}

function unauthorized(res, message = "Invalid credentials") {
  return res.status(401).json({
    error: {
      code: "UNAUTHORIZED",
      message,
      retryable: false
    }
  });
}

function emailConflict(res) {
  return res.status(409).json({
    error: {
      code: "EMAIL_CONFLICT",
      message: "An account with this email address already exists",
      retryable: false
    }
  });
}

function conflict(res, code, message) {
  return res.status(409).json({
    error: {
      code,
      message,
      retryable: false
    }
  });
}

function notFound(res, message) {
  return res.status(404).json({
    error: {
      code: "NOT_FOUND",
      message,
      retryable: false
    }
  });
}

function getRequiredString(body, fieldName) {
  const value = body?.[fieldName];

  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function getOptionalString(body, fieldName) {
  const value = body?.[fieldName];

  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed || null;
}

function hasBodyField(body, fieldName) {
  return Object.prototype.hasOwnProperty.call(body || {}, fieldName);
}

function getRefreshTokenFromRequest(req) {
  const cookieToken = req.cookies?.[env.cookieName];

  if (typeof cookieToken === "string" && cookieToken.trim()) {
    return cookieToken;
  }

  const bodyToken = req.body?.refreshToken;

  if (typeof bodyToken === "string" && bodyToken.trim()) {
    return bodyToken;
  }

  return null;
}

function isBrowserClient(req) {
  return Boolean(req.get("origin"));
}

function authResponseBody(req, accessToken, refreshToken, user) {
  const body = {
    accessToken,
    user: {
      id: user.id,
      role: user.role,
      name: user.name,
      hostelId: user.hostelId,
      roomNumber: user.roomNumber
    }
  };

  if (!isBrowserClient(req)) {
    body.refreshToken = refreshToken;
  }

  return body;
}

function refreshResponseBody(req, accessToken, refreshToken) {
  const body = { accessToken };

  if (!isBrowserClient(req)) {
    body.refreshToken = refreshToken;
  }

  return body;
}

function loginRateLimitKey(req, email) {
  const subject = `${req.ip || req.socket?.remoteAddress || "unknown"}:${email.toLowerCase()}`;
  const digest = createHmac("sha256", env.jwtSecret).update(subject).digest("hex");
  return `${LOGIN_RATE_LIMIT_NAMESPACE}:${digest}`;
}

async function isLoginRateLimited(key) {
  const redis = await getRedisClient();
  const count = Number((await redis.get(key)) || 0);
  return count >= MAX_FAILED_LOGIN_ATTEMPTS;
}

async function recordFailedLogin(key) {
  const redis = await getRedisClient();
  const count = await redis.incr(key);

  if (count === 1) {
    await redis.expire(key, LOGIN_RATE_LIMIT_WINDOW_SECONDS);
  }
}

async function clearLoginFailures(key) {
  const redis = await getRedisClient();
  await redis.del(key);
}

function rateLimited(res) {
  return res.status(429).json({
    error: {
      code: "RATE_LIMITED",
      message: "Too many failed login attempts. Try again later.",
      retryable: true
    }
  });
}

function isUniqueEmailViolation(error) {
  return (
    error?.code === "23505" &&
    (String(error.constraint || "").includes("users_email") ||
      String(error.detail || "").toLowerCase().includes("email"))
  );
}

function isParentStudentLinkViolation(error) {
  return (
    error?.code === "23505" &&
    (String(error.constraint || "").includes("parent_students") ||
      String(error.detail || "").toLowerCase().includes("student_id"))
  );
}

function isNitjStudentEmail(email) {
  return STUDENT_EMAIL_PATTERN.test(email);
}

function isUuid(value) {
  return UUID_PATTERN.test(value);
}

function mapHostel(row) {
  return {
    id: row.id,
    name: row.name,
    centerLat: row.center_lat === null ? null : Number(row.center_lat),
    centerLng: row.center_lng === null ? null : Number(row.center_lng),
    radiusMetres: row.radius_metres,
    createdAt: row.created_at
  };
}

function mapManagedUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    hostelId: user.hostelId,
    roomNumber: user.roomNumber,
    isActive: user.isActive,
    hostelName: user.hostelName || null
  };
}

function getRequiredNumber(body, fieldName) {
  const rawValue = body?.[fieldName];

  if (typeof rawValue === "string" && !rawValue.trim()) {
    return null;
  }

  const value = Number(rawValue);

  if (!Number.isFinite(value)) {
    return null;
  }

  return value;
}

async function hostelExists(hostelId) {
  const { rowCount } = await pool.query(
    `
      SELECT 1
      FROM hostels
      WHERE id = $1
      LIMIT 1
    `,
    [hostelId]
  );

  return rowCount > 0;
}

router.post("/login", async (req, res, next) => {
  try {
    const email = getRequiredString(req.body, "email");
    const password = getRequiredString(req.body, "password");

    if (!email || !password) {
      return validationError(res, "Email and password are required");
    }

    const rateLimitKey = loginRateLimitKey(req, email);

    if (await isLoginRateLimited(rateLimitKey)) {
      return rateLimited(res);
    }

    const user = await findUserByEmail(email);

    if (!user || !user.isActive) {
      await recordFailedLogin(rateLimitKey);
      return unauthorized(res);
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);

    if (!passwordMatches) {
      await recordFailedLogin(rateLimitKey);
      return unauthorized(res);
    }

    await clearLoginFailures(rateLimitKey);

    const accessToken = createAccessToken(user);
    const refreshToken = createRefreshToken(user);

    await persistRefreshSession(
      refreshToken,
      {
        userId: user.id,
        role: user.role,
        hostelId: user.hostelId
      },
      getRefreshTokenTtlMs()
    );

    return res
      .cookie(env.cookieName, refreshToken, authCookieOptions())
      .status(200)
      .json(authResponseBody(req, accessToken, refreshToken, user));
  } catch (error) {
    return next(error);
  }
});

router.post("/refresh", async (req, res, next) => {
  try {
    const refreshToken = getRefreshTokenFromRequest(req);

    if (!refreshToken) {
      return res.status(401).json({
        error: {
          code: "UNAUTHORIZED",
          message: "Refresh token missing or revoked",
          retryable: false
        }
      });
    }

    let payload;

    try {
      payload = verifyRefreshToken(refreshToken);
    } catch (_error) {
      await revokeRefreshSession(refreshToken);
      return res.status(401).json({
        error: {
          code: "UNAUTHORIZED",
          message: "Refresh token expired",
          retryable: false
        }
      });
    }

    const session = await consumeRefreshSession(refreshToken);

    if (!session || session.userId !== payload.sub) {
      return res.status(401).json({
        error: {
          code: "UNAUTHORIZED",
          message: "Refresh token missing or revoked",
          retryable: false
        }
      });
    }

    const user = await findUserById(payload.sub);

    if (!user || !user.isActive) {
      return res.status(401).json({
        error: {
          code: "UNAUTHORIZED",
          message: "User no longer exists",
          retryable: false
        }
      });
    }

    const accessToken = createAccessToken(user);
    const nextRefreshToken = createRefreshToken(user);

    await persistRefreshSession(
      nextRefreshToken,
      {
        userId: user.id,
        role: user.role,
        hostelId: user.hostelId
      },
      getRefreshTokenTtlMs()
    );

    return res
      .cookie(env.cookieName, nextRefreshToken, authCookieOptions())
      .status(200)
      .json(refreshResponseBody(req, accessToken, nextRefreshToken));
  } catch (error) {
    return next(error);
  }
});

router.post("/logout", async (req, res, next) => {
  try {
    const refreshToken = getRefreshTokenFromRequest(req);

    if (refreshToken) {
      await revokeRefreshSession(refreshToken);
    }

    return res.clearCookie(env.cookieName, clearCookieOptions()).status(204).send();
  } catch (error) {
    return next(error);
  }
});

router.post("/signup", async (req, res, next) => {
  try {
    const name = getRequiredString(req.body, "name");
    const email = getRequiredString(req.body, "email");
    const password = getRequiredString(req.body, "password");
    const hostelId = getRequiredString(req.body, "hostelId");
    const roomNumber = getOptionalString(req.body, "roomNumber");

    if (!name || !email || !password || !hostelId || roomNumber === undefined) {
      return validationError(res, "Name, email, password, and hostel block are required");
    }

    if (
      ["parentName", "parentEmail", "parentPassword", "studentId"].some((fieldName) =>
        hasBodyField(req.body, fieldName)
      )
    ) {
      return validationError(
        res,
        "Parent signup is separate. Parents should register with the student's registered ID."
      );
    }

    if (!isNitjStudentEmail(email)) {
      return validationError(res, "Students must use an email address ending in @nitj.ac.in");
    }

    const existingUser = await findUserByEmail(email);

    if (existingUser) {
      return emailConflict(res);
    }

    const passwordHash = await bcrypt.hash(password, 10);
    let user;

    try {
      user = await createUser({
        name,
        email,
        passwordHash,
        hostelId,
        roomNumber
      });
    } catch (error) {
      if (isUniqueEmailViolation(error)) {
        return emailConflict(res);
      }

      throw error;
    }

    const accessToken = createAccessToken(user);
    const refreshToken = createRefreshToken(user);

    await persistRefreshSession(
      refreshToken,
      {
        userId: user.id,
        role: user.role,
        hostelId: user.hostelId
      },
      getRefreshTokenTtlMs()
    );

    return res
      .cookie(env.cookieName, refreshToken, authCookieOptions())
      .status(201)
      .json(authResponseBody(req, accessToken, refreshToken, user));
  } catch (error) {
    return next(error);
  }
});

router.post("/signup/parent", async (req, res, next) => {
  try {
    const name = getRequiredString(req.body, "name");
    const email = getRequiredString(req.body, "email");
    const password = getRequiredString(req.body, "password");
    const studentId = getRequiredString(req.body, "studentId");

    if (!name || !email || !password || !studentId) {
      return validationError(res, "Name, email, password, and registered student ID are required");
    }

    if (!isUuid(studentId)) {
      return validationError(res, "Registered student ID must be a valid ID");
    }

    const student = await findUserById(studentId);

    if (!student || !student.isActive || student.role !== "student") {
      return notFound(res, "Registered student ID not found");
    }

    const existingUser = await findUserByEmail(email);

    if (existingUser) {
      return emailConflict(res);
    }

    const existingLink = await findParentLinkByStudentId(student.id);

    if (existingLink) {
      return conflict(
        res,
        "STUDENT_ALREADY_LINKED",
        "This registered student already has a linked parent account"
      );
    }

    const passwordHash = await bcrypt.hash(password, 10);
    let parent;

    try {
      parent = await createParentForStudent({
        name,
        email,
        passwordHash,
        student
      });
    } catch (error) {
      if (isUniqueEmailViolation(error)) {
        return emailConflict(res);
      }

      if (isParentStudentLinkViolation(error)) {
        return conflict(
          res,
          "STUDENT_ALREADY_LINKED",
          "This registered student already has a linked parent account"
        );
      }

      throw error;
    }

    const accessToken = createAccessToken(parent);
    const refreshToken = createRefreshToken(parent);

    await persistRefreshSession(
      refreshToken,
      {
        userId: parent.id,
        role: parent.role,
        hostelId: parent.hostelId
      },
      getRefreshTokenTtlMs()
    );

    return res
      .cookie(env.cookieName, refreshToken, authCookieOptions())
      .status(201)
      .json(authResponseBody(req, accessToken, refreshToken, parent));
  } catch (error) {
    return next(error);
  }
});

router.get("/hostels", async (req, res, next) => {
  try {
    const { rows } = await pool.query("SELECT id, name FROM hostels ORDER BY name ASC");
    return res.status(200).json({ data: rows });
  } catch (error) {
    return next(error);
  }
});

router.get("/admin/hostels", requireAuth(["super_admin"]), async (_req, res, next) => {
  try {
    const { rows } = await pool.query(
      `
        SELECT id, name, center_lat, center_lng, radius_metres, created_at
        FROM hostels
        ORDER BY name ASC
      `
    );

    return res.status(200).json({
      data: rows.map(mapHostel)
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/admin/hostels", requireAuth(["super_admin"]), async (req, res, next) => {
  try {
    const name = getRequiredString(req.body, "name");
    const centerLat = getRequiredNumber(req.body, "centerLat");
    const centerLng = getRequiredNumber(req.body, "centerLng");
    const radiusMetres = getRequiredNumber(req.body, "radiusMetres");

    if (!name || centerLat === null || centerLng === null || radiusMetres === null) {
      return validationError(res, "name, centerLat, centerLng, and radiusMetres are required");
    }

    if (centerLat < -90 || centerLat > 90 || centerLng < -180 || centerLng > 180) {
      return validationError(res, "centerLat and centerLng must be valid coordinates");
    }

    if (!Number.isInteger(radiusMetres) || radiusMetres <= 0) {
      return validationError(res, "radiusMetres must be a positive integer");
    }

    const { rows } = await pool.query(
      `
        INSERT INTO hostels (name, center_lat, center_lng, radius_metres)
        VALUES ($1, $2, $3, $4)
        RETURNING id, name, center_lat, center_lng, radius_metres, created_at
      `,
      [name, centerLat, centerLng, radiusMetres]
    );

    return res.status(201).json({
      data: mapHostel(rows[0])
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/admin/wardens", requireAuth(["super_admin"]), async (_req, res, next) => {
  try {
    return res.status(200).json({
      data: (await listWardens()).map(mapManagedUser)
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/admin/wardens", requireAuth(["super_admin"]), async (req, res, next) => {
  try {
    const name = getRequiredString(req.body, "name");
    const email = getRequiredString(req.body, "email");
    const password = getRequiredString(req.body, "password");
    const hostelId = getRequiredString(req.body, "hostelId");

    if (!name || !email || !password || !hostelId) {
      return validationError(res, "name, email, password, and hostelId are required");
    }

    if (!(await hostelExists(hostelId))) {
      return res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: "Hostel not found",
          retryable: false
        }
      });
    }

    const existingUser = await findUserByEmail(email);

    if (existingUser) {
      return emailConflict(res);
    }

    const passwordHash = await bcrypt.hash(password, 10);
    let user;

    try {
      user = await createUser({
        name,
        email,
        passwordHash,
        role: "warden",
        hostelId
      });
    } catch (error) {
      if (isUniqueEmailViolation(error)) {
        return emailConflict(res);
      }

      throw error;
    }

    return res.status(201).json({
      data: mapManagedUser(user)
    });
  } catch (error) {
    return next(error);
  }
});

export { router as authRoutes };
