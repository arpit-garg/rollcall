import http from "node:http";
import { createApp } from "./app.js";
import { closePool } from "./config/db.js";
import { env } from "./config/env.js";
import { closeRedisClient } from "./config/redis.js";
import { initSocketServer } from "./services/socketEmitter.js";
import { startVerificationWorker, stopVerificationWorker } from "./services/verificationQueue.js";

const app = createApp();
const httpServer = http.createServer(app);

initSocketServer(httpServer);

if (env.enableVerificationWorker) {
  // Phase 4A runs one in-process worker per attendance-service instance.
  startVerificationWorker();
}

const server = httpServer.listen(env.port, () => {
  console.log(`attendance-service listening on port ${env.port}`);
});

async function shutdown() {
  await stopVerificationWorker();
  await closeRedisClient();
  await closePool();
  server.close(() => {
    process.exit(0);
  });
}

process.on("SIGINT", () => {
  void shutdown();
});

process.on("SIGTERM", () => {
  void shutdown();
});

