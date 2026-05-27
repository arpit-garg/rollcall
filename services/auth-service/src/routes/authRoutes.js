import bcrypt from "bcryptjs";
import { Router } from "express";
import { findUserByEmail, findUserById, createUser } from "../repositories/usersRepository.js";
import { pool } from "../config/db.js";
import {
  getRefreshSession,
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

function authCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    maxAge: getRefreshTokenTtlMs()
  };
}

function clearCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: false
  };
}

router.post("/login", async (req, res, next) => {
  try {
    const { email, password } = req.body ?? {};

    if (!email || !password) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Email and password are required",
          retryable: false
        }
      });
    }

    const user = await findUserByEmail(email);

    if (!user || !user.isActive) {
      return res.status(401).json({
        error: {
          code: "UNAUTHORIZED",
          message: "Invalid credentials",
          retryable: false
        }
      });
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);

    if (!passwordMatches) {
      return res.status(401).json({
        error: {
          code: "UNAUTHORIZED",
          message: "Invalid credentials",
          retryable: false
        }
      });
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
      .cookie("refreshToken", refreshToken, authCookieOptions())
      .status(200)
      .json({
        accessToken,
        refreshToken,
        user: {
          id: user.id,
          role: user.role,
          name: user.name,
          hostelId: user.hostelId,
          roomNumber: user.roomNumber
        }
      });
  } catch (error) {
    return next(error);
  }
});

router.post("/refresh", async (req, res, next) => {
  try {
    const refreshToken = req.cookies.refreshToken || req.body?.refreshToken;

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

    const session = await getRefreshSession(refreshToken);

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
      await revokeRefreshSession(refreshToken);
      return res.status(401).json({
        error: {
          code: "UNAUTHORIZED",
          message: "User no longer exists",
          retryable: false
        }
      });
    }

    return res.status(200).json({
      accessToken: createAccessToken(user)
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/logout", async (req, res, next) => {
  try {
    const refreshToken = req.cookies.refreshToken || req.body?.refreshToken;

    if (refreshToken) {
      await revokeRefreshSession(refreshToken);
    }

    return res.clearCookie("refreshToken", clearCookieOptions()).status(204).send();
  } catch (error) {
    return next(error);
  }
});

router.post("/signup", async (req, res, next) => {
  try {
    const { name, email, password, hostelId, roomNumber } = req.body ?? {};

    if (!name || !email || !password || !hostelId) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Name, email, password, and hostel block are required",
          retryable: false
        }
      });
    }

    const existingUser = await findUserByEmail(email);

    if (existingUser) {
      return res.status(409).json({
        error: {
          code: "EMAIL_CONFLICT",
          message: "An account with this email address already exists",
          retryable: false
        }
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await createUser({
      name,
      email,
      passwordHash,
      hostelId,
      roomNumber
    });

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
      .cookie("refreshToken", refreshToken, authCookieOptions())
      .status(201)
      .json({
        accessToken,
        refreshToken,
        user: {
          id: user.id,
          role: user.role,
          name: user.name,
          hostelId: user.hostelId,
          roomNumber: user.roomNumber
        }
      });
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

