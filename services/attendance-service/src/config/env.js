import "dotenv/config";

export const env = {
  port: Number(process.env.ATTENDANCE_SERVICE_PORT || process.env.PORT || 3002),
  databaseUrl:
    process.env.DATABASE_URL || "postgresql://postgres:postgres@127.0.0.1:5432/hostel_attendance",
  redisUrl: process.env.REDIS_URL || "redis://127.0.0.1:6379",
  jwtSecret: process.env.JWT_SECRET || "dev-access-secret",
  mlServiceUrl: process.env.ML_SERVICE_URL || "http://localhost:8000",
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
  verificationDemoDelayMs: Number(process.env.VERIFICATION_DEMO_DELAY_MS || 1500),
  enableVerificationWorker:
    String(process.env.ENABLE_VERIFICATION_WORKER || "true") === "true",
  enableDemoResolution: String(process.env.ENABLE_DEMO_RESOLUTION || "true") === "true"
};
