import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

const DAY_MS = 24 * 60 * 60 * 1000;

export function signAccessToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      role: user.role,
      hostelId: user.hostel_id
    },
    env.jwtSecret,
    { expiresIn: env.accessTokenTtl }
  );
}

export function signRefreshToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      role: user.role
    },
    env.refreshTokenSecret,
    { expiresIn: env.refreshTokenTtl }
  );
}

export function verifyRefreshToken(token) {
  return jwt.verify(token, env.refreshTokenSecret);
}

export function getRefreshTokenTtlMs() {
  return 7 * DAY_MS;
}
