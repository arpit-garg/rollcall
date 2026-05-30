import { createClient } from "redis";
import { env } from "../config/env.js";
import { getRedisClient } from "../config/redis.js";
import { requestAttendanceVerification } from "./mlClient.js";
import { resolveAttendanceRecord } from "./attendanceService.js";
import { removeObject } from "./objectStorage.js";
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

async function requeueProcessingJobs(redis) {
  while (!stopRequested) {
    const payload = await redis.sendCommand([
      "RPOPLPUSH",
      env.verificationProcessingQueueName,
      env.verificationQueueName
    ]);

    if (!payload) {
      return;
    }
  }
}

async function processVerificationJob(job) {
  if (env.enableDemoResolution) {
    await new Promise((resolve) => setTimeout(resolve, env.verificationDemoDelayMs));
    return {
      status: "verified",
      faceScore: 0.98,
      livenessScore: 0.99
    };
  }

  return requestAttendanceVerification({
    studentId: job.studentId,
    jobId: job.jobId,
    imageObjectKey: job.imageObjectKey,
    templateRef: job.templateRef
  });
}

async function resolveRecordWithRetry(jobId, outcome, maxRetries = 5) {
  let delay = 1000;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await resolveAttendanceRecord(jobId, outcome);
    } catch (error) {
      console.error(`[Worker] resolveAttendanceRecord attempt ${attempt} failed: ${error.message}`);
      if (attempt === maxRetries) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, delay));
      delay *= 2;
    }
  }
}

async function removeObjectBestEffort(objectKey) {
  try {
    await removeObject(objectKey);
  } catch (error) {
    console.warn(`[Worker] Failed to remove verification object ${objectKey}: ${error.message}`);
  }
}

async function workerLoop() {
  metrics.workerActive = true;
  const redis = await getWorkerRedisClient();
  await requeueProcessingJobs(redis);

  while (!stopRequested) {
    try {
      const payload = await redis.sendCommand([
        "BRPOPLPUSH",
        env.verificationQueueName,
        env.verificationProcessingQueueName,
        "1"
      ]);

      if (!payload) {
        continue;
      }

      const job = JSON.parse(payload);

      let outcome;
      try {
        outcome = await processVerificationJob(job);
      } catch (error) {
        console.error(`[Worker] ML verification job ${job.jobId} failed: ${error.message}`);
        outcome = {
          status: "failed",
          faceScore: null,
          livenessScore: null
        };
      }

      try {
        const resolvedRecord = await resolveRecordWithRetry(job.jobId, outcome);
        await removeObjectBestEffort(job.imageObjectKey);
        await redis.lRem(env.verificationProcessingQueueName, 1, payload);
        emitAttendanceResolved({
          jobId: job.jobId,
          studentId: job.studentId,
          hostelId: resolvedRecord?.hostelId,
          ...outcome
        });

        if (outcome.status === "failed") {
          metrics.failedJobs += 1;
          metrics.lastFailure = `ML verification returned failed status for job ${job.jobId}`;
        } else {
          metrics.processedJobs += 1;
          metrics.lastProcessedJobId = job.jobId;
          metrics.lastProcessedAt = new Date().toISOString();
          metrics.lastFailure = null;
        }
      } catch (dbError) {
        console.error(`[Worker] Critical DB failure: could not resolve job ${job.jobId} after retries. Error: ${dbError.message}`);
        metrics.failedJobs += 1;
        metrics.lastFailure = `Database resolution failed: ${dbError.message}`;
      }
    } catch (outerError) {
      console.error(`[Worker] Critical outer loop error: ${outerError.message}`);
      metrics.lastFailure = `Outer loop error: ${outerError.message}`;
      await new Promise((resolve) => setTimeout(resolve, 2000));
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
  let processingJobs = 0;

  try {
    const redis = await getRedisClient();
    const rawPendingJobs = await redis.sendCommand(["LLEN", env.verificationQueueName]);
    const rawProcessingJobs = await redis.sendCommand(["LLEN", env.verificationProcessingQueueName]);
    pendingJobs = Number(rawPendingJobs);
    processingJobs = Number(rawProcessingJobs);
  } catch (error) {
    metrics.lastFailure = error.message;
    pendingJobs = -1;
    processingJobs = -1;
  }

  return {
    ...metrics,
    pendingJobs,
    processingJobs
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
