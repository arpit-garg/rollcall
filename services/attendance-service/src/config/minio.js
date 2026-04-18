import { Client } from "minio";
import { env } from "./env.js";

let minioClient;

function parseEndpoint(endpoint) {
  const hasProtocol = endpoint.startsWith("http://") || endpoint.startsWith("https://");
  const url = new URL(hasProtocol ? endpoint : `http://${endpoint}`);

  return {
    endPoint: url.hostname,
    port: Number(url.port || (url.protocol === "https:" ? 443 : 80)),
    useSSL: url.protocol === "https:"
  };
}

export function getMinioClient() {
  if (!minioClient) {
    minioClient = new Client({
      ...parseEndpoint(env.minioEndpoint),
      accessKey: env.minioAccessKey,
      secretKey: env.minioSecretKey
    });
  }

  return minioClient;
}
