import "dotenv/config";

const nodeEnv = process.env.NODE_ENV || "development";
const isLocalLike = ["development", "test", "local"].includes(nodeEnv);
const jwtSecret = process.env.JWT_SECRET || (isLocalLike ? "dev-access-secret" : "");
const demoResolutionRequested = String(process.env.ENABLE_DEMO_RESOLUTION || "false") === "true";

if (!isLocalLike && jwtSecret.length < 32) {
  throw new Error("JWT_SECRET must be configured with at least 32 characters");
}

if (!isLocalLike && demoResolutionRequested) {
  throw new Error("ENABLE_DEMO_RESOLUTION cannot be enabled outside local/test environments");
}

export const env = {
  nodeEnv,
  port: Number(process.env.ATTENDANCE_SERVICE_PORT || process.env.PORT || 3002),
  databaseUrl:
    process.env.DATABASE_URL || "postgresql://postgres:postgres@127.0.0.1:5432/hostel_attendance",
  redisUrl: process.env.REDIS_URL || "redis://127.0.0.1:6379",
  jwtSecret,
  mlServiceUrl: process.env.ML_SERVICE_URL || "http://localhost:8000",
  mlRequestTimeoutMs: Number(process.env.ML_REQUEST_TIMEOUT_MS || 5000),
  minioEndpoint: process.env.MINIO_ENDPOINT || "127.0.0.1:9000",
  minioAccessKey: process.env.MINIO_ACCESS_KEY || "minioadmin",
  minioSecretKey: process.env.MINIO_SECRET_KEY || "minioadmin",
  minioBucket: process.env.MINIO_BUCKET || "face-templates",
  hostelCenterLat: Number(
    process.env.DEMO_HOSTEL_CENTER_LAT || process.env.HOSTEL_CENTER_LAT || 28.613939
  ),
  hostelCenterLng: Number(
    process.env.DEMO_HOSTEL_CENTER_LNG || process.env.HOSTEL_CENTER_LNG || 77.209023
  ),
  hostelRadiusMetres: Number(
    process.env.DEMO_HOSTEL_RADIUS_METRES || process.env.HOSTEL_RADIUS_METRES || 150
  ),
  similarityThreshold: Number(process.env.FACE_SIMILARITY_THRESHOLD || 0.75),
  faceSimilarityThreshold: Number(process.env.FACE_SIMILARITY_THRESHOLD || 0.75),
  livenessThreshold: Number(process.env.LIVENESS_THRESHOLD || 0.8),
  maxAttemptsPerWindow: Number(process.env.MAX_ATTEMPTS_PER_WINDOW || 3),
  attendanceIdempotencyNamespace:
    process.env.ATTENDANCE_IDEMPOTENCY_NAMESPACE || "attendance:idempotency",
  verificationQueueName:
    process.env.VERIFICATION_QUEUE_NAME || "attendance:verification:queue",
  verificationProcessingQueueName:
    process.env.VERIFICATION_PROCESSING_QUEUE_NAME || "attendance:verification:processing",
  verificationDemoDelayMs: Number(process.env.VERIFICATION_DEMO_DELAY_MS || 1500),
  enableVerificationWorker:
    String(process.env.ENABLE_VERIFICATION_WORKER || "true") === "true",
  enableDemoResolution: isLocalLike && demoResolutionRequested
};
