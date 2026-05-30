import { createHmac } from "node:crypto";
import bcrypt from "bcryptjs";
import { Router } from "express";
import { env } from "../config/env.js";
import { findUserByEmail, findUserById, createUser } from "../repositories/usersRepository.js";
import { pool } from "../config/db.js";
import { getRedisClient } from "../config/redis.js";
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

router.get("/hostels", async (req, res, next) => {
  try {
    const { rows } = await pool.query("SELECT id, name FROM hostels ORDER BY name ASC");
    return res.status(200).json({ data: rows });
  } catch (error) {
    return next(error);
  }
});

export { router as authRoutes };
