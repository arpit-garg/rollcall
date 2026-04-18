import { createApp } from "./app.js";
import { closePool } from "./config/db.js";
import { env } from "./config/env.js";
import { closeRedisClient } from "./config/redis.js";
import { startVerificationWorker, stopVerificationWorker } from "./services/verificationQueue.js";

const app = createApp();

if (env.enableVerificationWorker) {
  // Phase 4A runs one in-process worker per attendance-service instance.
  startVerificationWorker();
}

const server = app.listen(env.port, () => {
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
