import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

export function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization;
    const token = header?.startsWith("Bearer ") ? header.slice(7) : null;

    if (!token) {
      return res.status(401).json({
        error: {
          code: "UNAUTHORIZED",
          message: "Bearer token is required",
          retryable: false
        }
      });
    }

    req.user = jwt.verify(token, env.jwtSecret);
    next();
  } catch (_error) {
    res.status(401).json({
      error: {
        code: "UNAUTHORIZED",
        message: "Token is invalid or expired",
        retryable: false
      }
    });
  }
}

export function requireRole(role) {
  return (req, res, next) => {
    if (req.user?.role !== role) {
      return res.status(403).json({
        error: {
          code: "FORBIDDEN",
          message: `${role} role required`,
          retryable: false
        }
      });
    }

    next();
  };
}
