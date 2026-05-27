import { createClient } from "redis";
import { env } from "../config/env.js";
import { getRedisClient } from "../config/redis.js";
import { requestAttendanceVerification } from "./mlClient.js";
import { resolveAttendanceRecord } from "./attendanceService.js";
import { emitAttendanceResolved } from "./socketEmitter.js";

const metrics = {
  workerActive: false,
  processedJobs: 0,
  failedJobs: 0,
  lastProcessedJobId: null,
  lastProcessedAt: null,
  lastFailure: null
};

let workerPromise;
let stopRequested = false;
let workerRedisClient;
let workerConnectPromise;

async function processVerificationJob(job) {
  return requestAttendanceVerification({
    studentId: job.studentId,
    jobId: job.jobId,
    imageObjectKey: job.imageObjectKey,
    templateRef: job.templateRef
  });
}

async function workerLoop() {
  metrics.workerActive = true;
  const redis = await getWorkerRedisClient();

  while (!stopRequested) {
    const result = await redis.sendCommand(["BRPOP", env.verificationQueueName, "1"]);

    if (!result) {
      continue;
    }

    const [, payload] = result;
    const job = JSON.parse(payload);

    try {
      const outcome = await processVerificationJob(job);
      await resolveAttendanceRecord(job.jobId, outcome);
      emitAttendanceResolved({ jobId: job.jobId, studentId: job.studentId, ...outcome });
      metrics.processedJobs += 1;
      metrics.lastProcessedJobId = job.jobId;
      metrics.lastProcessedAt = new Date().toISOString();
      metrics.lastFailure = null;
    } catch (error) {
      metrics.failedJobs += 1;
      metrics.lastFailure = error.message;
      await resolveAttendanceRecord(job.jobId, {
        status: "failed",
        faceScore: null,
        livenessScore: null
      });
      emitAttendanceResolved({ jobId: job.jobId, studentId: job.studentId, status: "failed", faceScore: null, livenessScore: null });
    }
  }

  metrics.workerActive = false;
}

export function startVerificationWorker() {
  if (!workerPromise) {
    stopRequested = false;
    workerPromise = workerLoop().catch((error) => {
      metrics.workerActive = false;
      metrics.lastFailure = error.message;
      workerPromise = null;
    });
  }

  return workerPromise;
}

export async function enqueueVerificationJob(job) {
  const redis = await getRedisClient();
  await redis.rPush(env.verificationQueueName, JSON.stringify(job));
}

export async function getVerificationQueueStatus() {
  let pendingJobs = 0;

  try {
    const redis = await getRedisClient();
    const rawPendingJobs = await redis.sendCommand(["LLEN", env.verificationQueueName]);
    pendingJobs = Number(rawPendingJobs);
  } catch (error) {
    metrics.lastFailure = error.message;
    pendingJobs = -1;
  }

  return {
    ...metrics,
    pendingJobs
  };
}

export async function stopVerificationWorker() {
  stopRequested = true;

  if (workerPromise) {
    await workerPromise;
    workerPromise = null;
  }

  if (workerRedisClient?.isOpen) {
    await workerRedisClient.quit();
  }

  workerRedisClient = undefined;
  workerConnectPromise = null;
}

async function getWorkerRedisClient() {
  if (!workerRedisClient) {
    workerRedisClient = createClient({
      url: env.redisUrl
    });

    workerRedisClient.on("error", (error) => {
      metrics.lastFailure = error.message;
      console.error("attendance-service verification worker redis error", error);
    });
  }

  if (!workerRedisClient.isOpen) {
    workerConnectPromise ??= workerRedisClient.connect();
    await workerConnectPromise;
    workerConnectPromise = null;
  }

  return workerRedisClient;
}
