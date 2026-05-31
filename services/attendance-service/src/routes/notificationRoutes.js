import { Router } from "express";
import {
  listUnreadNotifications,
  markNotificationRead
} from "../repositories/notificationsRepository.js";

const router = Router();

router.get("/unread", async (req, res, next) => {
  try {
    return res.status(200).json({
      data: await listUnreadNotifications(req.user.id)
    });
  } catch (error) {
    return next(error);
  }
});

router.patch("/:id/read", async (req, res, next) => {
  try {
    const notification = await markNotificationRead(req.params.id, req.user.id);

    if (!notification) {
      return res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: "Notification not found",
          retryable: false
        }
      });
    }

    return res.status(200).json(notification);
  } catch (error) {
    return next(error);
  }
});

export { router as notificationRoutes };
