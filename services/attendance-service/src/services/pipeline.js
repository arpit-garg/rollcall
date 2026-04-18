import {
  completeEnrollment,
  markReEnrollmentRequired
} from "./enrollmentService.js";
import {
  requestEnrollmentProcessing
} from "./mlClient.js";

export async function runEnrollmentPipeline({ studentId, imageMeta }) {
  try {
    const result = await requestEnrollmentProcessing({ studentId, imageMeta });
    await completeEnrollment(studentId, result.modelVersion || "facenet-v1");
  } catch (_error) {
    await markReEnrollmentRequired(studentId);
  }
}
