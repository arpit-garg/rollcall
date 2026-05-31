import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { findActiveUserById } from "../repositories/usersRepository.js";

function unauthorized(res) {
  return res.status(401).json({
    error: {
      code: "UNAUTHORIZED",
      message: "Token invalid or expired",
      retryable: false
    }
  });
}

function normalizeHostelId(value) {
  return value ?? null;
}

export async function resolveAuthenticatedUserFromToken(token) {
  const payload = jwt.verify(token, env.jwtSecret);

  if (!payload.sub || !payload.role || !Object.prototype.hasOwnProperty.call(payload, "hostelId")) {
    return null;
  }

  const user = await findActiveUserById(payload.sub);

  if (!user) {
    return null;
  }

  if (user.role !== payload.role || normalizeHostelId(user.hostelId) !== normalizeHostelId(payload.hostelId)) {
    return null;
  }

  return {
    id: user.id,
    role: user.role,
    hostelId: normalizeHostelId(user.hostelId)
  };
}

export function requireAuth(allowedRoles = []) {
  return async (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({
        error: {
          code: "UNAUTHORIZED",
          message: "Bearer token required",
          retryable: false
        }
      });
    }

    try {
      const token = authHeader.replace("Bearer ", "");
      const user = await resolveAuthenticatedUserFromToken(token);

      if (!user) {
        return unauthorized(res);
      }

      req.user = user;

      if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
        return res.status(403).json({
          error: {
            code: "FORBIDDEN",
            message: "Insufficient privileges",
            retryable: false
          }
        });
      }

      return next();
    } catch (_error) {
      return unauthorized(res);
    }
  };
}
