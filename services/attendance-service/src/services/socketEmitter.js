import { Server } from "socket.io";
import { resolveAuthenticatedUserFromToken } from "../middlewares/auth.js";

let io = null;

export async function authenticateSocketToken(token) {
  if (!token) {
    return null;
  }

  try {
    return await resolveAuthenticatedUserFromToken(token);
  } catch (_error) {
    return null;
  }
}

export function initSocketServer(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: true,
      credentials: true
    }
  });

  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    const user = await authenticateSocketToken(Array.isArray(token) ? token[0] : token);

    if (!user) {
      return next(new Error("UNAUTHORIZED"));
    }

    socket.user = user;
    return next();
  });

  io.on("connection", (socket) => {
    socket.join(`hostel:${socket.user.hostelId}`);
    socket.join(`user:${socket.user.id}`);
    console.log(`[socket.io] authenticated client connected: ${socket.id}`);
    socket.on("disconnect", () => {
      console.log(`[socket.io] client disconnected: ${socket.id}`);
    });
  });

  return io;
}

export function emitAttendanceResolved(record) {
  if (!io) return;
  if (record.hostelId) {
    io.to(`hostel:${record.hostelId}`).emit("attendance:resolved", record);
  }
  io.to(`user:${record.studentId}`).emit("attendance:resolved", record);
}

export function emitEnrollmentUpdated(studentId, status) {
  if (!io) return;
  io.to(`user:${studentId}`).emit("enrollment:updated", { studentId, status });
}
