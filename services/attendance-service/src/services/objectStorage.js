import { randomUUID } from "node:crypto";
import { getMinioClient } from "../config/minio.js";
import { env } from "../config/env.js";

async function ensureBucket() {
  const client = getMinioClient();
  const exists = await client.bucketExists(env.minioBucket);

  if (!exists) {
    await client.makeBucket(env.minioBucket);
  }

  try {
    const lifecycleConfig = {
      Rule: [
        {
          ID: "ExpireTempUploads",
          Status: "Enabled",
          Filter: {
            Prefix: "temp/"
          },
          Expiration: {
            Days: 1
          }
        }
      ]
    };
    await client.setBucketLifecycle(env.minioBucket, lifecycleConfig);
  } catch (lifecycleError) {
    console.warn(`[MinIO] Failed to configure bucket lifecycle: ${lifecycleError.message}`);
  }

  return client;
}

export async function uploadTempObject({ studentId, imageName, buffer, contentType, category }) {
  const client = await ensureBucket();
  const objectKey = `temp/${category}/${studentId}/${Date.now()}-${randomUUID()}-${imageName}`;

  await client.putObject(env.minioBucket, objectKey, buffer, buffer.length, {
    "Content-Type": contentType
  });

  return objectKey;
}

export async function removeObject(objectKey) {
  const client = await ensureBucket();
  await client.removeObject(env.minioBucket, objectKey);
}

export async function listObjects(prefix) {
  const client = await ensureBucket();
  const objects = [];

  await new Promise((resolve, reject) => {
    const stream = client.listObjects(env.minioBucket, prefix, true);

    stream.on("data", (objectInfo) => {
      objects.push(objectInfo.name);
    });
    stream.on("end", resolve);
    stream.on("error", reject);
  });

  return objects;
}
