import { env } from "../config/env.js";
import { getRedisClient } from "../config/redis.js";

function idempotencyKey(windowId, studentId, clientKey) {
  return `${env.attendanceIdempotencyNamespace}:${windowId}:${studentId}:${clientKey}`;
}

export async function getSubmissionJobId(windowId, studentId, clientKey) {
  const redis = await getRedisClient();
  return redis.get(idempotencyKey(windowId, studentId, clientKey));
}

export async function rememberSubmissionJob(windowId, studentId, clientKey, jobId) {
  const redis = await getRedisClient();
  await redis.set(idempotencyKey(windowId, studentId, clientKey), jobId, {
    EX: 600
  });
}
