import { createClient } from "redis";
import { env } from "./env.js";

let redisClient;
let connectPromise;

export async function getRedisClient() {
  if (!redisClient) {
    redisClient = createClient({
      url: env.redisUrl
    });

    redisClient.on("error", (error) => {
      console.error("auth-service redis error", error);
    });
  }

  if (!redisClient.isOpen) {
    connectPromise ??= redisClient.connect();
    await connectPromise;
    connectPromise = null;
  }

  return redisClient;
}

export async function closeRedisClient() {
  if (redisClient?.isOpen) {
    await redisClient.quit();
  }

  redisClient = undefined;
  connectPromise = null;
}
