import { Server } from "socket.io";

let io = null;

export function initSocketServer(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: true,
      credentials: true
    }
  });

  io.on("connection", (socket) => {
    console.log(`[socket.io] client connected: ${socket.id}`);
    socket.on("disconnect", () => {
      console.log(`[socket.io] client disconnected: ${socket.id}`);
    });
  });

  return io;
}

export function emitAttendanceResolved(record) {
  if (!io) return;
  io.emit("attendance:resolved", record);
}

export function emitEnrollmentUpdated(studentId, status) {
  if (!io) return;
  io.emit("enrollment:updated", { studentId, status });
}
