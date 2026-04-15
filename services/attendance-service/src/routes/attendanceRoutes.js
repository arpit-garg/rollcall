import { Router } from "express";
import multer from "multer";
import { attendanceStore } from "../services/attendanceStore.js";
import { runAttendancePipeline } from "../services/pipeline.js";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }
});

router.post("/submit", upload.single("image"), (req, res, next) => {
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

    const result = attendanceStore.createSubmission({
      studentId: req.user.id,
      hostelId: req.user.hostelId,
      latitude,
      longitude,
      idempotencyKey,
      imageMeta: req.file
    });

    if (result.duplicate) {
      return res.status(409).json({
        jobId: result.record.jobId,
        status: result.record.status,
        message: "Submission already in progress"
      });
    }

    void runAttendancePipeline({
      studentId: req.user.id,
      jobId: result.record.jobId,
      imageMeta: req.file
    });

    return res.status(202).json({
      jobId: result.record.jobId,
      status: result.record.status,
      message: "Verification in progress"
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/job/:jobId", (req, res, next) => {
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
    const record = attendanceStore.getJob(req.params.jobId, req.user.id);
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

router.get("/my-history", (req, res) => {
  if (req.user.role !== "student") {
    return res.status(403).json({
      error: {
        code: "FORBIDDEN",
        message: "Only students can view their attendance history",
        retryable: false
      }
    });
  }

  res.status(200).json({
    data: attendanceStore.getStudentHistory(req.user.id)
  });
});

router.post("/:recordId/override", (req, res, next) => {
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
    const result = attendanceStore.createOverride(req.params.recordId, req.user.id, reason);

    return res.status(200).json({
      status: result.record.status,
      override: result.override
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/overrides", (_req, res) => {
  if (_req.user.role !== "warden") {
    return res.status(403).json({
      error: {
        code: "FORBIDDEN",
        message: "Only wardens can view overrides",
        retryable: false
      }
    });
  }

  res.status(200).json({
    data: attendanceStore.listOverrides()
  });
});

export { router as attendanceRoutes };
