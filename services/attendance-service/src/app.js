import cors from "cors";
import express from "express";
import { errorHandler } from "./middlewares/errorHandler.js";
import { requireAuth } from "./middlewares/auth.js";
import { attendanceRoutes } from "./routes/attendanceRoutes.js";
import { enrollmentRoutes } from "./routes/enrollmentRoutes.js";
import { windowRoutes } from "./routes/windowRoutes.js";

export function createApp() {
  const app = express();

  app.use(
    cors({
      origin: true,
      credentials: true
    })
  );
  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.status(200).json({
      status: "ok",
      service: "attendance-service"
    });
  });

  app.use("/api/v1/enrollment", requireAuth(["student", "warden"]), enrollmentRoutes);
  app.use("/api/v1/windows", requireAuth(["warden"]), windowRoutes);
  app.use("/api/v1/attendance", requireAuth(["student", "warden"]), attendanceRoutes);
  app.use(errorHandler);

  return app;
}
