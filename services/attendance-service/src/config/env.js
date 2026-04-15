const required = ["PORT", "DATABASE_URL", "JWT_SECRET", "ML_SERVICE_URL"];

for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

export const env = {
  port: Number(process.env.PORT),
  databaseUrl: process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET,
  mlServiceUrl: process.env.ML_SERVICE_URL,
  hostelCenterLat: Number(process.env.HOSTEL_CENTER_LAT ?? 0),
  hostelCenterLng: Number(process.env.HOSTEL_CENTER_LNG ?? 0),
  hostelRadiusMetres: Number(process.env.HOSTEL_RADIUS_METRES ?? 150),
  faceSimilarityThreshold: Number(process.env.FACE_SIMILARITY_THRESHOLD ?? 0.75),
  livenessThreshold: Number(process.env.LIVENESS_THRESHOLD ?? 0.8)
};
