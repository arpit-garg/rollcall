import { env } from "../config/env.js";
import { runRedisCommands } from "../config/redis.js";

function refreshSessionKey(token) {
  return `${env.refreshTokenNamespace}:${token}`;
}

export async function persistRefreshSession(token, payload, ttlMs) {
  const ttlSeconds = Math.max(1, Math.floor(ttlMs / 1000));
  await runRedisCommands([
    ["SET", refreshSessionKey(token), JSON.stringify(payload), "EX", ttlSeconds]
  ]);
}

export async function getRefreshSession(token) {
  const [payload] = await runRedisCommands([["GET", refreshSessionKey(token)]]);

  return payload ? JSON.parse(payload) : null;
}

export async function revokeRefreshSession(token) {
  await runRedisCommands([["DEL", refreshSessionKey(token)]]);
}
