import { Router } from "express";
import multer from "multer";
import {
  getEnrollmentStatus,
  markReEnrollmentRequired,
  startEnrollment
} from "../services/enrollmentService.js";
import { uploadTempObject } from "../services/objectStorage.js";
import { runEnrollmentPipeline } from "../services/pipeline.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }
});

const router = Router();

router.post("/face", upload.single("image"), async (req, res, next) => {
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

  try {
    await startEnrollment(req.user.id);
    const imageObjectKey = await uploadTempObject({
      category: "enrollment",
      studentId: req.user.id,
      imageName: req.file.originalname || "camera-capture.jpg",
      buffer: req.file.buffer,
      contentType: req.file.mimetype
    });

    void runEnrollmentPipeline({
      studentId: req.user.id,
      imageObjectKey
    });

    return res.status(202).json({
      status: "processing",
      message: "Template generation queued"
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/status", async (req, res, next) => {
  if (req.user.role !== "student") {
    return res.status(403).json({
      error: {
        code: "FORBIDDEN",
        message: "Only students can check enrollment status",
        retryable: false
      }
    });
  }

  try {
    return res.status(200).json(await getEnrollmentStatus(req.user.id));
  } catch (error) {
    return next(error);
  }
});

router.delete("/face", async (req, res, next) => {
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

  try {
    await markReEnrollmentRequired(studentId);
    return res.status(200).json({
      status: "invalidated",
      studentId
    });
  } catch (error) {
    return next(error);
  }
});

export { router as enrollmentRoutes };
