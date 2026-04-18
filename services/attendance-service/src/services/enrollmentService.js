import {
  findFaceTemplate,
  getEnrollmentStatus as getStatusFromDb,
  invalidateTemplate,
  setEnrollmentProcessing,
  upsertEnrolledTemplate
} from "../repositories/faceTemplatesRepository.js";
import { removeObject } from "./objectStorage.js";

export async function getEnrollmentStatus(studentId) {
  return getStatusFromDb(studentId);
}

export async function startEnrollment(studentId) {
  const existingTemplate = await findFaceTemplate(studentId);

  if (existingTemplate?.embedding_ref?.startsWith("templates/")) {
    await removeObject(existingTemplate.embedding_ref);
  }

  await setEnrollmentProcessing(studentId);
}

export async function completeEnrollment(studentId, modelVersion, embeddingRef) {
  const existingTemplate = await findFaceTemplate(studentId);

  if (
    existingTemplate?.embedding_ref?.startsWith("templates/") &&
    existingTemplate.embedding_ref !== embeddingRef
  ) {
    await removeObject(existingTemplate.embedding_ref);
  }

  await upsertEnrolledTemplate(studentId, modelVersion, embeddingRef);
}

export async function markReEnrollmentRequired(studentId) {
  const existingTemplate = await findFaceTemplate(studentId);

  if (existingTemplate?.embedding_ref?.startsWith("templates/")) {
    await removeObject(existingTemplate.embedding_ref);
  }

  await invalidateTemplate(studentId);
}
