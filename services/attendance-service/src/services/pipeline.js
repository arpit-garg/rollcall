import {
  completeEnrollment,
  failEnrollmentAttempt
} from "./enrollmentService.js";
import {
  requestEnrollmentProcessing
} from "./mlClient.js";
import { env } from "../config/env.js";
import { getMinioClient } from "../config/minio.js";
import { removeObject } from "./objectStorage.js";
import { emitEnrollmentUpdated } from "./socketEmitter.js";

async function removeObjectBestEffort(objectKey) {
  try {
    await removeObject(objectKey);
  } catch (error) {
    console.warn(`[Enrollment Pipeline] Failed to remove temp object ${objectKey}: ${error.message}`);
  }
}

export async function runEnrollmentPipeline({ studentId, imageObjectKey, attemptId }) {
  let result;

  try {
    result = env.enableDemoResolution
      ? await createDemoEnrollmentResult(studentId, attemptId)
      : await requestEnrollmentProcessing({ studentId, imageObjectKey });

    if (result.status !== "enrolled" || !result.embeddingRef?.startsWith("templates/")) {
      throw new Error("Enrollment processing failed");
    }

    const updated = await completeEnrollment(
      studentId,
      result.modelVersion || "facenet-v1",
      result.embeddingRef,
      attemptId
    );
    if (updated) {
      await removeObjectBestEffort(imageObjectKey);
      emitEnrollmentUpdated(studentId, "enrolled");
    } else if (result.embeddingRef?.startsWith("templates/")) {
      await removeObjectBestEffort(result.embeddingRef);
    }
  } catch (_error) {
    if (result?.embeddingRef?.startsWith("templates/")) {
      await removeObjectBestEffort(result.embeddingRef);
    }
    await removeObjectBestEffort(imageObjectKey);
    await failEnrollmentAttempt(studentId, attemptId);
    emitEnrollmentUpdated(studentId, "re_enrollment_required");
  }
}

async function createDemoEnrollmentResult(studentId, attemptId) {
  const embeddingRef = `templates/${studentId}/${attemptId}.json`;
  const payload = Buffer.from(JSON.stringify({
    studentId,
    modelVersion: "demo-facenet-v1",
    embedding: [0.1, 0.2, 0.3]
  }));

  await getMinioClient().putObject(env.minioBucket, embeddingRef, payload, payload.length, {
    "Content-Type": "application/json"
  });

  return {
    status: "enrolled",
    modelVersion: "demo-facenet-v1",
    embeddingRef
  };
}
