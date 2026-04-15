import { randomUUID } from "node:crypto";
import { env } from "../config/env.js";
import { haversineDistance } from "./geo.js";
import { httpError } from "./httpError.js";

class AttendanceStore {
  constructor() {
    this.hostels = new Map();
    this.windows = new Map();
    this.records = new Map();
    this.recordsByJobId = new Map();
    this.idempotencyKeys = new Map();
    this.faceTemplates = new Map();
    this.overrides = new Map();
    this.auditLogs = [];
    this.retryLimitPerWindow = 3;

    this.seed();
  }

  seed() {
    const hostel = {
      id: "0f68b6d1-a7cf-47cf-b23e-7e4ff6ca58a4",
      name: "Main Boys Hostel",
      centerLat: env.hostelCenterLat,
      centerLng: env.hostelCenterLng,
      radiusMetres: env.hostelRadiusMetres
    };

    this.hostels.set(hostel.id, hostel);
    this.faceTemplates.set("8f71928b-74d0-4dbb-b30a-1e5da85a20fd", {
      studentId: "8f71928b-74d0-4dbb-b30a-1e5da85a20fd",
      status: "enrolled",
      modelVersion: "demo-facenet-v1",
      isValid: true,
      updatedAt: new Date().toISOString()
    });
  }

  getHostel(hostelId) {
    return this.hostels.get(hostelId) || null;
  }

  getEnrollmentStatus(studentId) {
    const template = this.faceTemplates.get(studentId);

    if (!template) {
      return { status: "not_enrolled" };
    }

    if (!template.isValid) {
      return { status: "re_enrollment_required", updatedAt: template.updatedAt };
    }

    return {
      status: template.status,
      modelVersion: template.modelVersion,
      updatedAt: template.updatedAt
    };
  }

  startEnrollment(studentId) {
    this.faceTemplates.set(studentId, {
      studentId,
      status: "processing",
      modelVersion: null,
      isValid: false,
      updatedAt: new Date().toISOString()
    });
  }

  completeEnrollment(studentId, modelVersion) {
    this.faceTemplates.set(studentId, {
      studentId,
      status: "enrolled",
      modelVersion,
      isValid: true,
      updatedAt: new Date().toISOString()
    });
  }

  invalidateEnrollment(studentId) {
    this.faceTemplates.set(studentId, {
      studentId,
      status: "re_enrollment_required",
      modelVersion: null,
      isValid: false,
      updatedAt: new Date().toISOString()
    });
  }

  createWindow({ hostelId, openedBy, opensAt, closesAt }) {
    const now = new Date();
    const window = {
      id: randomUUID(),
      hostelId,
      openedBy,
      date: now.toISOString().slice(0, 10),
      opensAt,
      closesAt,
      isOpen: true,
      createdAt: now.toISOString()
    };

    this.windows.set(window.id, window);
    this.appendAudit(openedBy, "WINDOW_OPENED", "attendance_windows", window.id, {
      opensAt,
      closesAt
    });

    return window;
  }

  listWindows(hostelId) {
    return Array.from(this.windows.values())
      .filter((window) => window.hostelId === hostelId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  closeWindow(windowId, actorId) {
    const window = this.windows.get(windowId);

    if (!window) {
      throw httpError(404, "NOT_FOUND", "Attendance window not found");
    }

    window.isOpen = false;
    this.appendAudit(actorId, "WINDOW_CLOSED", "attendance_windows", windowId, {});
    return window;
  }

  getWindowRecords(windowId) {
    return Array.from(this.records.values()).filter((record) => record.windowId === windowId);
  }

  getStudentHistory(studentId) {
    return Array.from(this.records.values())
      .filter((record) => record.studentId === studentId)
      .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
  }

  getJob(jobId, studentId) {
    const recordId = this.recordsByJobId.get(jobId);
    const record = recordId ? this.records.get(recordId) : null;

    if (!record || record.studentId !== studentId) {
      throw httpError(404, "NOT_FOUND", "Attendance job not found");
    }

    return record;
  }

  createSubmission({
    studentId,
    hostelId,
    latitude,
    longitude,
    idempotencyKey,
    imageMeta
  }) {
    const activeWindow = this.findActiveWindow(hostelId);

    if (!activeWindow) {
      throw httpError(410, "WINDOW_CLOSED", "Attendance window is not currently open");
    }

    const template = this.faceTemplates.get(studentId);

    if (!template || !template.isValid) {
      throw httpError(409, "TEMPLATE_NOT_ENROLLED", "Face enrollment is required before attendance");
    }

    const hostel = this.getHostel(hostelId);
    const distance = haversineDistance(latitude, longitude, hostel.centerLat, hostel.centerLng);

    if (distance > hostel.radiusMetres) {
      throw httpError(422, "GEO_OUT_OF_RANGE", "You are not within hostel boundary");
    }

    const idempotencyLookupKey = `${activeWindow.id}:${studentId}:${idempotencyKey}`;
    const existingJobId = this.idempotencyKeys.get(idempotencyLookupKey);

    if (existingJobId) {
      const existingRecord = this.getJob(existingJobId, studentId);
      return {
        duplicate: true,
        record: existingRecord
      };
    }

    const nonFailedRecord = Array.from(this.records.values()).find(
      (record) =>
        record.windowId === activeWindow.id &&
        record.studentId === studentId &&
        ["pending", "verified", "overridden"].includes(record.status)
    );

    if (nonFailedRecord) {
      throw httpError(
        409,
        "DUPLICATE_SUBMISSION",
        "Attendance has already been submitted for this window"
      );
    }

    const failedAttempts = Array.from(this.records.values()).filter(
      (record) =>
        record.windowId === activeWindow.id &&
        record.studentId === studentId &&
        record.status === "failed"
    ).length;

    if (failedAttempts >= this.retryLimitPerWindow) {
      throw httpError(
        409,
        "RETRY_LIMIT_EXCEEDED",
        "Retry limit reached for this attendance window"
      );
    }

    const record = {
      id: randomUUID(),
      windowId: activeWindow.id,
      studentId,
      status: "pending",
      jobId: randomUUID(),
      geoLat: latitude,
      geoLng: longitude,
      geoVerified: true,
      faceScore: null,
      livenessScore: null,
      submittedAt: new Date().toISOString(),
      resolvedAt: null,
      imageName: imageMeta?.originalname || "camera-capture.jpg"
    };

    this.records.set(record.id, record);
    this.recordsByJobId.set(record.jobId, record.id);
    this.idempotencyKeys.set(idempotencyLookupKey, record.jobId);
    this.appendAudit(studentId, "ATTENDANCE_SUBMITTED", "attendance_records", record.id, {
      windowId: activeWindow.id,
      imageName: record.imageName
    });

    return { duplicate: false, record };
  }

  resolveRecord(jobId, outcome) {
    const recordId = this.recordsByJobId.get(jobId);
    const record = recordId ? this.records.get(recordId) : null;

    if (!record || record.status !== "pending") {
      return null;
    }

    record.status = outcome.status;
    record.faceScore = outcome.faceScore;
    record.livenessScore = outcome.livenessScore;
    record.resolvedAt = new Date().toISOString();

    this.appendAudit(record.studentId, "VERIFICATION_RESULT", "attendance_records", record.id, {
      status: outcome.status,
      faceScore: outcome.faceScore,
      livenessScore: outcome.livenessScore
    });

    return record;
  }

  createOverride(recordId, wardenId, reason) {
    const record = this.records.get(recordId);

    if (!record) {
      throw httpError(404, "NOT_FOUND", "Attendance record not found");
    }

    if (!reason || !reason.trim()) {
      throw httpError(400, "VALIDATION_ERROR", "Override reason is required");
    }

    if (record.studentId === wardenId) {
      throw httpError(403, "FORBIDDEN", "Wardens cannot override their own records");
    }

    record.status = "overridden";
    record.resolvedAt = new Date().toISOString();

    const override = {
      id: randomUUID(),
      attendanceRecordId: recordId,
      wardenId,
      reason: reason.trim(),
      overrideAt: new Date().toISOString()
    };

    this.overrides.set(override.id, override);
    this.appendAudit(wardenId, "ATTENDANCE_OVERRIDE", "attendance_records", recordId, {
      reason: override.reason
    });

    return { record, override };
  }

  listOverrides() {
    return Array.from(this.overrides.values()).sort(
      (a, b) => new Date(b.overrideAt) - new Date(a.overrideAt)
    );
  }

  appendAudit(actorId, action, entityType, entityId, metadata) {
    this.auditLogs.push({
      id: this.auditLogs.length + 1,
      actorId,
      action,
      entityType,
      entityId,
      metadata,
      createdAt: new Date().toISOString()
    });
  }

  findActiveWindow(hostelId) {
    const now = Date.now();

    return Array.from(this.windows.values()).find((window) => {
      const opensAt = new Date(window.opensAt).getTime();
      const closesAt = new Date(window.closesAt).getTime();

      return (
        window.hostelId === hostelId &&
        window.isOpen &&
        opensAt <= now &&
        closesAt >= now
      );
    });
  }
}

export const attendanceStore = new AttendanceStore();
