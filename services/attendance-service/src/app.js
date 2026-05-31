import cors from "cors";
import express from "express";
import { env } from "./config/env.js";
import { errorHandler } from "./middlewares/errorHandler.js";
import { requireAuth } from "./middlewares/auth.js";
import { attendanceRoutes } from "./routes/attendanceRoutes.js";
import { enrollmentRoutes } from "./routes/enrollmentRoutes.js";
import { notificationRoutes } from "./routes/notificationRoutes.js";
import { windowRoutes } from "./routes/windowRoutes.js";
import { getVerificationQueueStatus } from "./services/verificationQueue.js";

export function createApp() {
  const app = express();

  app.use(
    cors({
      origin: true,
      credentials: true
    })
  );
  app.use(express.json());

  app.get("/health", async (_req, res, next) => {
    try {
      res.status(200).json({
        status: "ok",
        service: "attendance-service",
        verificationMode: env.enableVerificationWorker
          ? "single-process worker enabled"
          : "worker disabled",
        queue: await getVerificationQueueStatus()
      });
    } catch (error) {
      next(error);
    }
  });

  app.use("/api/v1/enrollment", requireAuth(["student", "warden"]), enrollmentRoutes);
  app.use("/api/v1/notifications", requireAuth(["student"]), notificationRoutes);
  app.use("/api/v1/windows", requireAuth(["warden"]), windowRoutes);
  app.use("/api/v1/attendance", requireAuth(["student", "warden"]), attendanceRoutes);
  app.use(errorHandler);

  return app;
}
