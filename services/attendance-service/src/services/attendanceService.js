import { appendAuditLog } from "../repositories/auditLogsRepository.js";
import {
  countFailedAttempts,
  createOverride,
  createPendingRecord,
  findActiveRecord,
  findRecordByJobIdForStudent,
  getRecordById,
  getStudentHistory,
  listOverrides,
  resolveRecord
} from "../repositories/attendanceRepository.js";
import { findFaceTemplate } from "../repositories/faceTemplatesRepository.js";
import { findHostelById } from "../repositories/hostelsRepository.js";
import { findActiveWindow } from "../repositories/windowsRepository.js";
import { env } from "../config/env.js";
import { haversineDistance } from "./geo.js";
import { httpError } from "./httpError.js";
import { getSubmissionJobId, rememberSubmissionJob } from "./idempotencyStore.js";

export async function createSubmission({
  studentId,
  hostelId,
  latitude,
  longitude,
  idempotencyKey
}) {
  const activeWindow = await findActiveWindow(hostelId);

  if (!activeWindow) {
    throw httpError(410, "WINDOW_CLOSED", "Attendance window is not currently open");
  }

  const template = await findFaceTemplate(studentId);

  if (!template || !template.is_valid) {
    throw httpError(409, "TEMPLATE_NOT_ENROLLED", "Face enrollment is required before attendance");
  }

  const hostel = await findHostelById(hostelId);
  const distance = haversineDistance(latitude, longitude, hostel.centerLat, hostel.centerLng);

  if (distance > hostel.radiusMetres) {
    throw httpError(422, "GEO_OUT_OF_RANGE", "You are not within hostel boundary");
  }

  const existingJobId = await getSubmissionJobId(activeWindow.id, studentId, idempotencyKey);

  if (existingJobId) {
    const existingRecord = await findRecordByJobIdForStudent(existingJobId, studentId);

    if (existingRecord) {
      return {
        duplicate: true,
        record: existingRecord
      };
    }
  }

  const nonFailedRecord = await findActiveRecord(activeWindow.id, studentId);

  if (nonFailedRecord) {
    if (
      nonFailedRecord.status === "pending" &&
      new Date().getTime() - new Date(nonFailedRecord.submittedAt).getTime() > 5 * 60 * 1000
    ) {
      console.warn(`[Attendance] Stuck pending record found for student ${studentId} (submitted at ${nonFailedRecord.submittedAt}). Auto-failing to allow retry.`);
      await resolveAttendanceRecord(nonFailedRecord.jobId, {
        status: "failed",
        faceScore: null,
        livenessScore: null
      });
      // Fall through so the student can submit a new record!
    } else {
      return {
        duplicate: true,
        record: nonFailedRecord
      };
    }
  }

  const failedAttempts = await countFailedAttempts(activeWindow.id, studentId);

  if (failedAttempts >= env.maxAttemptsPerWindow) {
    throw httpError(409, "RETRY_LIMIT_EXCEEDED", "Retry limit reached for this attendance window");
  }

  let record;

  try {
    record = await createPendingRecord({
      windowId: activeWindow.id,
      studentId,
      latitude,
      longitude
    });
  } catch (error) {
    if (error.code === "23505") {
      const duplicateRecord = await findActiveRecord(activeWindow.id, studentId);

      if (duplicateRecord) {
        return {
          duplicate: true,
          record: duplicateRecord
        };
      }
    }

    throw error;
  }

  await appendAuditLog(studentId, "ATTENDANCE_SUBMITTED", "attendance_records", record.id, {
    windowId: activeWindow.id
  });

  await rememberSubmissionJob(activeWindow.id, studentId, idempotencyKey, record.jobId);

  return {
    duplicate: false,
    record,
    templateRef: template.embedding_ref
  };
}

export async function getJob(jobId, studentId) {
  const record = await findRecordByJobIdForStudent(jobId, studentId);

  if (!record) {
    throw httpError(404, "NOT_FOUND", "Attendance job not found");
  }

  return record;
}

export async function getHistory(studentId) {
  return getStudentHistory(studentId);
}

export async function createAttendanceOverride({ recordId, wardenId, hostelId, reason }) {
  if (!reason || !reason.trim()) {
    throw httpError(400, "VALIDATION_ERROR", "Override reason is required");
  }

  const record = await getRecordById(recordId);

  if (!record) {
    throw httpError(404, "NOT_FOUND", "Attendance record not found");
  }

  if (record.studentId === wardenId) {
    throw httpError(403, "FORBIDDEN", "Wardens cannot override their own records");
  }

  if (record.hostelId !== hostelId) {
    throw httpError(404, "NOT_FOUND", "Attendance record not found");
  }

  const result = await createOverride({
    recordId,
    wardenId,
    reason: reason.trim()
  });

  await appendAuditLog(wardenId, "ATTENDANCE_OVERRIDE", "attendance_records", recordId, {
    reason: reason.trim()
  });

  return result;
}

export async function getOverrides(hostelId) {
  return listOverrides(hostelId);
}

export async function resolveAttendanceRecord(jobId, outcome) {
  const record = await resolveRecord(jobId, outcome);

  if (record) {
    await appendAuditLog(record.studentId, "VERIFICATION_RESULT", "attendance_records", record.id, {
      status: outcome.status,
      faceScore: outcome.faceScore,
      livenessScore: outcome.livenessScore
    });
  }

  return record;
}
