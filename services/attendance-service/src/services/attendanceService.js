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
import { findFaceTemplate, invalidateTemplate } from "../repositories/faceTemplatesRepository.js";
import { findHostelById } from "../repositories/hostelsRepository.js";
import { findActiveWindow } from "../repositories/windowsRepository.js";
import { env } from "../config/env.js";
import { objectExists } from "./objectStorage.js";
import { haversineDistance } from "./geo.js";
import { httpError } from "./httpError.js";
import { getSubmissionJobId, rememberSubmissionJob } from "./idempotencyStore.js";

const MAX_GPS_ACCURACY_TOLERANCE_METRES = 30;

export async function createSubmission({
  studentId,
  hostelId,
  latitude,
  longitude,
  accuracyMetres = null,
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

  if (
    template.embedding_ref?.startsWith("templates/") &&
    !(await objectExists(template.embedding_ref))
  ) {
    console.warn(`[Attendance] Missing template object ${template.embedding_ref}; marking student ${studentId} for re-enrollment`);
    await invalidateTemplate(studentId);
    throw httpError(409, "TEMPLATE_NOT_ENROLLED", "Face enrollment is required before attendance");
  }

  const hostel = await findHostelById(hostelId);

  if (!hostel) {
    throw httpError(404, "NOT_FOUND", "Hostel not found");
  }

  const distance = haversineDistance(latitude, longitude, hostel.centerLat, hostel.centerLng);
  const accuracyTolerance = getAccuracyTolerance(accuracyMetres);
  const effectiveRadiusMetres = hostel.radiusMetres + accuracyTolerance;

  if (distance > effectiveRadiusMetres) {
    console.warn(
      `[Attendance] Geofence rejected student ${studentId} for hostel ${hostel.name}: ` +
        `distance=${Math.round(distance)}m radius=${hostel.radiusMetres}m ` +
        `accuracy=${accuracyMetres ?? "unknown"}m tolerance=${accuracyTolerance}m`
    );
    throw httpError(
      422,
      "GEO_OUT_OF_RANGE",
      `You are not within hostel boundary. Distance ${Math.round(distance)}m, allowed ${Math.round(effectiveRadiusMetres)}m.`
    );
  }

  const existingJobId = await getSubmissionJobId(activeWindow.id, studentId, idempotencyKey);

  if (existingJobId) {
    const existingRecord = await findRecordByJobIdForStudent(existingJobId, studentId);

    if (existingRecord && existingRecord.status !== "failed") {
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
    windowId: activeWindow.id,
    geofence: {
      distanceMetres: Math.round(distance),
      hostelRadiusMetres: hostel.radiusMetres,
      gpsAccuracyMetres: accuracyMetres,
      accuracyToleranceMetres: accuracyTolerance,
      effectiveRadiusMetres: Math.round(effectiveRadiusMetres)
    }
  });

  await rememberSubmissionJob(activeWindow.id, studentId, idempotencyKey, record.jobId);

  return {
    duplicate: false,
    record,
    templateRef: template.embedding_ref
  };
}

function getAccuracyTolerance(accuracyMetres) {
  if (accuracyMetres === null || accuracyMetres === undefined) {
    return 0;
  }

  const numericAccuracy = Number(accuracyMetres);

  if (!Number.isFinite(numericAccuracy) || numericAccuracy < 0) {
    return 0;
  }

  return Math.min(numericAccuracy, MAX_GPS_ACCURACY_TOLERANCE_METRES);
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

  if (record.status !== "failed") {
    throw httpError(409, "OVERRIDE_NOT_ALLOWED", "Only failed attendance records can be overridden");
  }

  const result = await createOverride({
    recordId,
    wardenId,
    reason: reason.trim()
  });

  if (!result) {
    throw httpError(409, "OVERRIDE_NOT_ALLOWED", "Only failed attendance records can be overridden");
  }

  await appendAuditLog(wardenId, "ATTENDANCE_OVERRIDE", "attendance_records", recordId, {
    reason: reason.trim()
  });

  return result;
}

export async function getOverrides(hostelId) {
  return listOverrides(hostelId);
}

export async function resolveAttendanceRecord(jobId, outcome) {
  validateOutcome(outcome);
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

function validateOutcome(outcome) {
  if (!["verified", "failed"].includes(outcome.status)) {
    throw httpError(422, "VALIDATION_ERROR", "Verification status must be verified or failed");
  }

  outcome.faceScore = validateScore(outcome.faceScore, "faceScore");
  outcome.livenessScore = validateScore(outcome.livenessScore, "livenessScore");
}

function validateScore(score, fieldName) {
  if (score === null || score === undefined) {
    return null;
  }

  const numericScore = Number(score);

  if (!Number.isFinite(numericScore) || numericScore < 0 || numericScore > 1) {
    throw httpError(422, "VALIDATION_ERROR", `${fieldName} must be between 0 and 1`);
  }

  return numericScore;
}
