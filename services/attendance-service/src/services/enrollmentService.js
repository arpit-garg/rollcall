import { randomUUID } from "node:crypto";
import {
  failEnrollmentAttempt as failEnrollmentAttemptRecord,
  findFaceTemplate,
  getEnrollmentStatus as getStatusFromDb,
  invalidateTemplate,
  setEnrollmentProcessing,
  upsertEnrolledTemplate
} from "../repositories/faceTemplatesRepository.js";
import { env } from "../config/env.js";
import { findUserById } from "../repositories/usersRepository.js";
import { objectExists, removeObject } from "./objectStorage.js";
import { httpError } from "./httpError.js";

async function removeObjectBestEffort(objectKey) {
  try {
    await removeObject(objectKey);
  } catch (error) {
    console.warn(`[Enrollment] Failed to remove object ${objectKey}: ${error.message}`);
  }
}

export async function getEnrollmentStatus(studentId) {
  const template = await findFaceTemplate(studentId);

  if (
    template?.is_valid &&
    template.enrollment_status !== "processing" &&
    isRealMlTemplateRequired(template)
  ) {
    console.warn(`[Enrollment] Demo template ${template.embedding_ref} cannot be used while real ML verification is enabled; marking student ${studentId} for re-enrollment`);
    await invalidateTemplate(studentId);
  } else if (
    template?.is_valid &&
    template.enrollment_status !== "processing" &&
    template.embedding_ref?.startsWith("templates/") &&
    !(await objectExists(template.embedding_ref))
  ) {
    console.warn(`[Enrollment] Missing template object ${template.embedding_ref}; marking student ${studentId} for re-enrollment`);
    await invalidateTemplate(studentId);
  }

  return getStatusFromDb(studentId);
}

function isRealMlTemplateRequired(template) {
  return !env.enableDemoResolution && !template.embedding_ref?.startsWith("templates/");
}

export async function startEnrollment(studentId) {
  const attemptId = randomUUID();
  await setEnrollmentProcessing(studentId, attemptId);
  return attemptId;
}

export async function completeEnrollment(studentId, modelVersion, embeddingRef, attemptId = null) {
  const existingTemplate = await findFaceTemplate(studentId);
  const updated = await upsertEnrolledTemplate(studentId, modelVersion, embeddingRef, attemptId);

  if (!updated) {
    return false;
  }

  if (
    existingTemplate?.embedding_ref?.startsWith("templates/") &&
    existingTemplate.embedding_ref !== embeddingRef
  ) {
    await removeObjectBestEffort(existingTemplate.embedding_ref);
  }

  return true;
}

export async function failEnrollmentAttempt(studentId, attemptId) {
  await failEnrollmentAttemptRecord(studentId, attemptId);
}

export async function markReEnrollmentRequired(studentId, hostelId = null) {
  if (hostelId) {
    const student = await findUserById(studentId);

    if (!student || student.role !== "student" || student.hostelId !== hostelId) {
      throw httpError(404, "NOT_FOUND", "Student not found");
    }
  }

  const existingTemplate = await findFaceTemplate(studentId);

  if (existingTemplate?.embedding_ref?.startsWith("templates/")) {
    await removeObjectBestEffort(existingTemplate.embedding_ref);
  }

  await invalidateTemplate(studentId);
}
