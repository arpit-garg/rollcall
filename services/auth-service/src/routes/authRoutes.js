import bcrypt from "bcryptjs";
import { Router } from "express";
import jwt from "jsonwebtoken";
import { demoUsers } from "../config/demoUsers.js";
import { env } from "../config/env.js";
import { createAccessToken, createRefreshToken } from "../utils/tokens.js";

const router = Router();
const refreshTokens = new Map();

router.post("/login", async (req, res) => {
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

  const user = demoUsers.find((candidate) => candidate.email === email);

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

  refreshTokens.set(refreshToken, user.id);

  res
    .cookie("refreshToken", refreshToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      maxAge: 7 * 24 * 60 * 60 * 1000
    })
    .status(200)
    .json({
      accessToken,
      user: {
        id: user.id,
        role: user.role,
        name: user.name,
        hostelId: user.hostelId,
        roomNumber: user.roomNumber
      }
    });
});

router.post("/refresh", (req, res) => {
  const refreshToken = req.cookies.refreshToken || req.body?.refreshToken;

  if (!refreshToken || !refreshTokens.has(refreshToken)) {
    return res.status(401).json({
      error: {
        code: "UNAUTHORIZED",
        message: "Refresh token missing or revoked",
        retryable: false
      }
    });
  }

  try {
    const payload = jwt.verify(refreshToken, env.refreshSecret);
    const user = demoUsers.find((candidate) => candidate.id === payload.sub);

    if (!user) {
      refreshTokens.delete(refreshToken);
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
  } catch (_error) {
    refreshTokens.delete(refreshToken);
    return res.status(401).json({
      error: {
        code: "UNAUTHORIZED",
        message: "Refresh token expired",
        retryable: false
      }
    });
  }
});

router.post("/logout", (req, res) => {
  const bearerToken = req.headers.authorization?.replace("Bearer ", "");
  const refreshToken = req.cookies.refreshToken || req.body?.refreshToken;

  if (bearerToken) {
    try {
      jwt.verify(bearerToken, env.jwtSecret);
    } catch (_error) {
      return res.status(401).json({
        error: {
          code: "UNAUTHORIZED",
          message: "Access token expired",
          retryable: false
        }
      });
    }
  }

  if (refreshToken) {
    refreshTokens.delete(refreshToken);
  }

  return res.clearCookie("refreshToken").status(204).send();
});

export { router as authRoutes };
