import "dotenv/config";

export const env = {
  port: Number(process.env.ATTENDANCE_SERVICE_PORT || process.env.PORT || 3002),
  databaseUrl:
    process.env.DATABASE_URL || "postgresql://postgres:postgres@127.0.0.1:5432/hostel_attendance",
  redisUrl: process.env.REDIS_URL || "redis://127.0.0.1:6379",
  jwtSecret: process.env.JWT_SECRET || "dev-access-secret",
  mlServiceUrl: process.env.ML_SERVICE_URL || "http://localhost:8000",
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
  enableDemoResolution: String(process.env.ENABLE_DEMO_RESOLUTION || "true") === "true"
};
