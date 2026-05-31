import { randomUUID } from "node:crypto";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const TTL_UNITS_MS = {
  ms: 1,
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: DAY_MS
};

export function createAccessToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      role: user.role,
      hostelId: user.hostelId ?? user.hostel_id ?? null
    },
    env.jwtSecret,
    { expiresIn: env.accessTokenTtl }
  );
}

export function createRefreshToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      role: user.role,
      jti: randomUUID()
    },
    env.refreshTokenSecret,
    { expiresIn: env.refreshTokenTtl }
  );
}

export function verifyRefreshToken(token) {
  return jwt.verify(token, env.refreshTokenSecret);
}

export function getRefreshTokenTtlMs() {
  const ttl = env.refreshTokenTtl;

  if (typeof ttl === "number") {
    return ttl * 1000;
  }

  const normalized = String(ttl).trim().toLowerCase();

  if (/^\d+$/.test(normalized)) {
    return Number(normalized) * 1000;
  }

  const match = normalized.match(/^(\d+)(ms|s|m|h|d)$/);

  if (!match) {
    throw new Error("REFRESH_TOKEN_TTL must be a positive duration such as 2h or 7d");
  }

  return Number(match[1]) * TTL_UNITS_MS[match[2]];
}
