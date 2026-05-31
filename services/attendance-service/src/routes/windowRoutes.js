import { Router } from "express";
import {
  closeWindow,
  listHostelWindows,
  listRecordsForWindow,
  listRosterForWindow,
  openWindow
} from "../services/windowService.js";

const router = Router();

router.post("/", async (req, res, next) => {
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

  try {
    const window = await openWindow({
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
  } catch (error) {
    return next(error);
  }
});

router.patch("/:id/close", async (req, res, next) => {
  try {
    const window = await closeWindow({
      windowId: req.params.id,
      hostelId: req.user.hostelId,
      actorId: req.user.id
    });

    return res.status(200).json({
      id: window.id,
      is_open: window.isOpen
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/", async (req, res, next) => {
  try {
    return res.status(200).json({
      data: await listHostelWindows(req.user.hostelId)
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/:id/records", async (req, res, next) => {
  try {
    return res.status(200).json({
      data: await listRecordsForWindow(req.params.id, req.user.hostelId)
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/:id/roster", async (req, res, next) => {
  try {
    return res.status(200).json({
      data: await listRosterForWindow(req.params.id, req.user.hostelId)
    });
  } catch (error) {
    return next(error);
  }
});

export { router as windowRoutes };
