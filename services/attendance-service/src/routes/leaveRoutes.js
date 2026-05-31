import { Router } from "express";
import {
  createLeaveRequest,
  decideLeaveRequestForParent,
  getLeaveRequestsForUser
} from "../services/leaveService.js";

const router = Router();

router.post("/", async (req, res, next) => {
  if (req.user.role !== "student") {
    return res.status(403).json({
      error: {
        code: "FORBIDDEN",
        message: "Only students can request leave",
        retryable: false
      }
    });
  }

  try {
    const leaveRequest = await createLeaveRequest({
      studentId: req.user.id,
      requestedFrom: req.body?.requestedFrom,
      requestedTo: req.body?.requestedTo,
      destination: req.body?.destination,
      reason: req.body?.reason
    });

    return res.status(201).json({
      data: leaveRequest
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/", async (req, res, next) => {
  try {
    return res.status(200).json({
      data: await getLeaveRequestsForUser({
        userId: req.user.id,
        role: req.user.role
      })
    });
  } catch (error) {
    return next(error);
  }
});

router.patch("/:id/decision", async (req, res, next) => {
  if (req.user.role !== "parent") {
    return res.status(403).json({
      error: {
        code: "FORBIDDEN",
        message: "Only parents can decide leave requests",
        retryable: false
      }
    });
  }

  try {
    return res.status(200).json({
      data: await decideLeaveRequestForParent({
        requestId: req.params.id,
        parentId: req.user.id,
        decision: req.body?.decision,
        note: req.body?.note
      })
    });
  } catch (error) {
    return next(error);
  }
});

export { router as leaveRoutes };
