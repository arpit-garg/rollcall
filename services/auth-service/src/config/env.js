function parseTokenTtl(explicitValue, numericValue, suffix) {
  if (explicitValue) {
    return explicitValue;
  }

  if (numericValue) {
    return `${numericValue}${suffix}`;
  }

  return undefined;
}

function parseBoolean(value, fallback) {
  if (value === undefined) {
    return fallback;
  }

  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

function resolveSecret(envName, localDefault, nodeEnv) {
  const value = process.env[envName];
  const localEnvironments = new Set(["development", "local", "test"]);

  if (localEnvironments.has(nodeEnv)) {
    return value || localDefault;
  }

  if (!value || value === localDefault || value.length < 32) {
    throw new Error(`${envName} must be set to a strong secret outside local/test environments`);
  }

  return value;
}

function resolveSameSite(value) {
  const normalized = (value || "lax").trim().toLowerCase();
  const allowed = new Set(["lax", "strict", "none"]);

  if (!allowed.has(normalized)) {
    throw new Error("REFRESH_TOKEN_COOKIE_SAMESITE must be one of lax, strict, or none");
  }

  return normalized;
}

const nodeEnv = process.env.NODE_ENV || "development";
const refreshTokenSecret = resolveSecret(
  "REFRESH_TOKEN_SECRET",
  "dev-refresh-secret",
  nodeEnv
);

export const env = {
  nodeEnv,
  port: Number(process.env.AUTH_SERVICE_PORT || process.env.PORT || 3001),
  databaseUrl:
    process.env.DATABASE_URL || "postgresql://postgres:postgres@127.0.0.1:5432/hostel_attendance",
  redisUrl: process.env.REDIS_URL || "redis://127.0.0.1:6379",
  jwtSecret: resolveSecret("JWT_SECRET", "dev-access-secret", nodeEnv),
  refreshSecret: refreshTokenSecret,
  refreshTokenSecret,
  accessTokenTtl:
    parseTokenTtl(process.env.ACCESS_TOKEN_TTL, process.env.ACCESS_TOKEN_TTL_MINUTES, "m") ||
    "15m",
  refreshTokenTtl:
    parseTokenTtl(process.env.REFRESH_TOKEN_TTL, process.env.REFRESH_TOKEN_TTL_DAYS, "d") ||
    "7d",
  cookieName: process.env.REFRESH_TOKEN_COOKIE_NAME ?? "refreshToken",
  cookieSecure: parseBoolean(process.env.COOKIE_SECURE, nodeEnv === "production"),
  cookieSameSite: resolveSameSite(process.env.REFRESH_TOKEN_COOKIE_SAMESITE),
  refreshTokenNamespace: process.env.REFRESH_TOKEN_NAMESPACE ?? "auth:refresh",
  clientOrigin: (process.env.CORS_ORIGIN || process.env.APP_ORIGIN || "http://localhost:5173")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
};
