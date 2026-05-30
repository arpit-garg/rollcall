import { Router } from "express";
import multer from "multer";
import {
  createAttendanceOverride,
  createSubmission,
  getHistory,
  getJob,
  getOverrides
} from "../services/attendanceService.js";
import { resolveAttendanceRecord } from "../services/attendanceService.js";
import { removeObject, uploadTempObject } from "../services/objectStorage.js";
import { enqueueVerificationJob } from "../services/verificationQueue.js";
import { getCurrentWindowForHostel } from "../services/windowService.js";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }
});
const MAX_GPS_ACCURACY_METRES = 30;

async function removeObjectBestEffort(objectKey, context) {
  try {
    await removeObject(objectKey);
  } catch (cleanupError) {
    console.warn(`[Attendance] Failed to remove temp image after ${context}: ${cleanupError.message}`);
  }
}

router.get("/current-window", async (req, res, next) => {
  try {
    return res.status(200).json({
      data: await getCurrentWindowForHostel(req.user.hostelId)
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/submit", upload.single("image"), async (req, res, next) => {
  if (req.user.role !== "student") {
    return res.status(403).json({
      error: {
        code: "FORBIDDEN",
        message: "Only students can submit attendance",
        retryable: false
      }
    });
  }

  try {
    const latitude = Number(req.body?.latitude);
    const longitude = Number(req.body?.longitude);
    const accuracyMetres =
      req.body?.accuracy_metres === undefined || req.body?.accuracy_metres === null
        ? null
        : Number(req.body.accuracy_metres);
    const idempotencyKey = req.body?.idempotency_key;

    if (!req.file || !Number.isFinite(latitude) || !Number.isFinite(longitude) || !idempotencyKey) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "image, latitude, longitude and idempotency_key are required",
          retryable: false
        }
      });
    }

    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "latitude must be between -90 and 90 and longitude must be between -180 and 180",
          retryable: false
        }
      });
    }

    if (
      accuracyMetres !== null &&
      (!Number.isFinite(accuracyMetres) || accuracyMetres < 0 || accuracyMetres > MAX_GPS_ACCURACY_METRES)
    ) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: `accuracy_metres must be between 0 and ${MAX_GPS_ACCURACY_METRES}`,
          retryable: false
        }
      });
    }

    const imageObjectKey = await uploadTempObject({
      category: "verification",
      studentId: req.user.id,
      imageName: req.file.originalname || "camera-capture.jpg",
      buffer: req.file.buffer,
      contentType: req.file.mimetype
    });

    let result;

    try {
      result = await createSubmission({
        studentId: req.user.id,
        hostelId: req.user.hostelId,
        latitude,
        longitude,
        accuracyMetres,
        idempotencyKey
      });
    } catch (error) {
      await removeObjectBestEffort(imageObjectKey, "submission rejection");
      throw error;
    }

    if (result.duplicate) {
      await removeObjectBestEffort(imageObjectKey, "duplicate submission");
      return res.status(409).json({
        jobId: result.record.jobId,
        status: result.record.status,
        message: "Submission already in progress"
      });
    }

    try {
      await enqueueVerificationJob({
        jobId: result.record.jobId,
        studentId: req.user.id,
        imageName: req.file.originalname || "camera-capture.jpg",
        imageObjectKey,
        templateRef: result.templateRef
      });
    } catch (error) {
      await removeObjectBestEffort(imageObjectKey, "enqueue failure");
      await resolveAttendanceRecord(result.record.jobId, {
        status: "failed",
        faceScore: null,
        livenessScore: null
      });
      throw error;
    }

    return res.status(202).json({
      jobId: result.record.jobId,
      status: result.record.status,
      message: "Verification in progress"
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/job/:jobId", async (req, res, next) => {
  if (req.user.role !== "student") {
    return res.status(403).json({
      error: {
        code: "FORBIDDEN",
        message: "Only students can query their attendance jobs",
        retryable: false
      }
    });
  }

  try {
    const record = await getJob(req.params.jobId, req.user.id);
    return res.status(200).json({
      jobId: record.jobId,
      status: record.status,
      faceScore: record.faceScore,
      livenessScore: record.livenessScore,
      submittedAt: record.submittedAt,
      resolvedAt: record.resolvedAt
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/my-history", async (req, res, next) => {
  if (req.user.role !== "student") {
    return res.status(403).json({
      error: {
        code: "FORBIDDEN",
        message: "Only students can view their attendance history",
        retryable: false
      }
    });
  }

  try {
    return res.status(200).json({
      data: await getHistory(req.user.id)
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/:recordId/override", async (req, res, next) => {
  if (req.user.role !== "warden") {
    return res.status(403).json({
      error: {
        code: "FORBIDDEN",
        message: "Only wardens can create overrides",
        retryable: false
      }
    });
  }

  try {
    const { reason } = req.body ?? {};
    const result = await createAttendanceOverride({
      recordId: req.params.recordId,
      wardenId: req.user.id,
      hostelId: req.user.hostelId,
      reason
    });

    return res.status(200).json({
      status: result.record.status,
      override: result.override
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/overrides", async (req, res, next) => {
  if (req.user.role !== "warden") {
    return res.status(403).json({
      error: {
        code: "FORBIDDEN",
        message: "Only wardens can view overrides",
        retryable: false
      }
    });
  }

  try {
    return res.status(200).json({
      data: await getOverrides(req.user.hostelId)
    });
  } catch (error) {
    return next(error);
  }
});

export { router as attendanceRoutes };
