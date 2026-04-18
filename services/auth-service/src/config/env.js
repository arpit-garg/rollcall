import "dotenv/config";

function parseTokenTtl(explicitValue, numericValue, suffix) {
  if (explicitValue) {
    return explicitValue;
  }

  if (numericValue) {
    return `${numericValue}${suffix}`;
  }

  return undefined;
}

export const env = {
  port: Number(process.env.AUTH_SERVICE_PORT || process.env.PORT || 3001),
  jwtSecret: process.env.JWT_SECRET || "dev-access-secret",
  refreshSecret: process.env.REFRESH_TOKEN_SECRET || "dev-refresh-secret",
  refreshTokenSecret: process.env.REFRESH_TOKEN_SECRET || "dev-refresh-secret",
  accessTokenTtl:
    parseTokenTtl(process.env.ACCESS_TOKEN_TTL, process.env.ACCESS_TOKEN_TTL_MINUTES, "m") ||
    "15m",
  refreshTokenTtl:
    parseTokenTtl(process.env.REFRESH_TOKEN_TTL, process.env.REFRESH_TOKEN_TTL_DAYS, "d") ||
    "7d",
  cookieName: process.env.REFRESH_TOKEN_COOKIE_NAME ?? "refreshToken",
  clientOrigin: (process.env.CORS_ORIGIN || process.env.APP_ORIGIN || "http://localhost:5173")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
};
