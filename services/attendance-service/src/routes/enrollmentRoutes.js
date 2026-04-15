import { Router } from "express";
import multer from "multer";
import { attendanceStore } from "../services/attendanceStore.js";
import { runEnrollmentPipeline } from "../services/pipeline.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }
});

const router = Router();

router.post("/face", upload.single("image"), (req, res) => {
  if (req.user.role !== "student") {
    return res.status(403).json({
      error: {
        code: "FORBIDDEN",
        message: "Only students can enroll face templates",
        retryable: false
      }
    });
  }

  if (!req.file) {
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "image is required",
        retryable: false
      }
    });
  }

  attendanceStore.startEnrollment(req.user.id);
  void runEnrollmentPipeline({
    studentId: req.user.id,
    imageMeta: req.file
  });

  res.status(202).json({
    status: "processing",
    message: "Template generation queued"
  });
});

router.get("/status", (req, res) => {
  if (req.user.role !== "student") {
    return res.status(403).json({
      error: {
        code: "FORBIDDEN",
        message: "Only students can check enrollment status",
        retryable: false
      }
    });
  }

  res.status(200).json(attendanceStore.getEnrollmentStatus(req.user.id));
});

router.delete("/face", (req, res) => {
  if (req.user.role !== "warden") {
    return res.status(403).json({
      error: {
        code: "FORBIDDEN",
        message: "Only wardens can invalidate templates",
        retryable: false
      }
    });
  }

  const studentId = req.body?.studentId;

  if (!studentId) {
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "studentId is required",
        retryable: false
      }
    });
  }

  attendanceStore.invalidateEnrollment(studentId);
  return res.status(200).json({
    status: "invalidated",
    studentId
  });
});

export { router as enrollmentRoutes };
