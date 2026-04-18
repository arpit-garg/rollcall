import "dotenv/config";

export const env = {
  port: Number(process.env.ATTENDANCE_SERVICE_PORT || process.env.PORT || 3002),
  databaseUrl: process.env.DATABASE_URL || "",
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
  enableDemoResolution: String(process.env.ENABLE_DEMO_RESOLUTION || "true") === "true"
};
