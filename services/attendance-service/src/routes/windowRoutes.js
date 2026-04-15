import { Router } from "express";
import { attendanceStore } from "../services/attendanceStore.js";

const router = Router();

router.post("/", (req, res) => {
  const { opens_at: opensAt, closes_at: closesAt } = req.body ?? {};

  if (!opensAt || !closesAt) {
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "opens_at and closes_at are required",
        retryable: false
      }
    });
  }

  const window = attendanceStore.createWindow({
    hostelId: req.user.hostelId,
    openedBy: req.user.id,
    opensAt,
    closesAt
  });

  return res.status(201).json({
    id: window.id,
    is_open: window.isOpen,
    opens_at: window.opensAt,
    closes_at: window.closesAt
  });
});

router.patch("/:id/close", (req, res) => {
  const window = attendanceStore.closeWindow(req.params.id, req.user.id);
  res.status(200).json({
    id: window.id,
    is_open: window.isOpen
  });
});

router.get("/", (req, res) => {
  res.status(200).json({
    data: attendanceStore.listWindows(req.user.hostelId)
  });
});

router.get("/:id/records", (req, res) => {
  res.status(200).json({
    data: attendanceStore.getWindowRecords(req.params.id)
  });
});

export { router as windowRoutes };
