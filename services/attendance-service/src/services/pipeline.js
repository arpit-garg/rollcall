import {
  completeEnrollment,
  markReEnrollmentRequired
} from "./enrollmentService.js";
import {
  requestEnrollmentProcessing
} from "./mlClient.js";
import { removeObject } from "./objectStorage.js";

export async function runEnrollmentPipeline({ studentId, imageObjectKey }) {
  try {
    const result = await requestEnrollmentProcessing({ studentId, imageObjectKey });
    await completeEnrollment(
      studentId,
      result.modelVersion || "facenet-v1",
      result.embeddingRef
    );
  } catch (_error) {
    await removeObject(imageObjectKey);
    await markReEnrollmentRequired(studentId);
  }
}
