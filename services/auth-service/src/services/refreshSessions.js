import { env } from "../config/env.js";
import { getRedisClient } from "../config/redis.js";

function refreshSessionKey(token) {
  return `${env.refreshTokenNamespace}:${token}`;
}

export async function persistRefreshSession(token, payload, ttlMs) {
  const ttlSeconds = Math.max(1, Math.floor(ttlMs / 1000));
  const redis = await getRedisClient();
  await redis.set(refreshSessionKey(token), JSON.stringify(payload), {
    EX: ttlSeconds
  });
}

export async function getRefreshSession(token) {
  const redis = await getRedisClient();
  const payload = await redis.get(refreshSessionKey(token));

  return payload ? JSON.parse(payload) : null;
}

export async function revokeRefreshSession(token) {
  const redis = await getRedisClient();
  await redis.del(refreshSessionKey(token));
}
