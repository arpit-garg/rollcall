import {
  getEnrollmentStatus as getStatusFromDb,
  invalidateTemplate,
  upsertEnrolledTemplate
} from "../repositories/faceTemplatesRepository.js";

export async function getEnrollmentStatus(studentId) {
  return getStatusFromDb(studentId);
}

export async function startEnrollment(studentId) {
  await invalidateTemplate(studentId);
}

export async function completeEnrollment(studentId, modelVersion) {
  await upsertEnrolledTemplate(studentId, modelVersion, `seed://${studentId}`);
}

export async function markReEnrollmentRequired(studentId) {
  await invalidateTemplate(studentId);
}
