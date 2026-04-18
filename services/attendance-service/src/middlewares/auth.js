import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

export function requireAuth(allowedRoles = []) {
  return (req, res, next) => {
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
      const payload = jwt.verify(token, env.jwtSecret);

      req.user = {
        id: payload.sub,
        role: payload.role,
        hostelId: payload.hostelId
      };

      if (allowedRoles.length > 0 && !allowedRoles.includes(req.user.role)) {
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
      return res.status(401).json({
        error: {
          code: "UNAUTHORIZED",
          message: "Token invalid or expired",
          retryable: false
        }
      });
    }
  };
}
