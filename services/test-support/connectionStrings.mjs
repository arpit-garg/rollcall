import "dotenv/config";

function toUrl(value, protocol) {
  return new URL(value.includes("://") ? value : `${protocol}//${value}`);
}

function rewriteDockerHostname(value, protocol, host = "127.0.0.1") {
  const url = toUrl(value, protocol);

  if (["postgres", "redis", "minio"].includes(url.hostname)) {
    url.hostname = host;
  }

  return url.toString();
}

export function resolveDatabaseUrl() {
  if (process.env.TEST_DATABASE_URL) {
    return process.env.TEST_DATABASE_URL;
  }

  if (process.env.DATABASE_URL) {
    return rewriteDockerHostname(process.env.DATABASE_URL, "postgresql:");
  }

  const user = process.env.POSTGRES_USER || "postgres";
  const password = process.env.POSTGRES_PASSWORD || "postgres";
  const database = process.env.POSTGRES_DB || "hostel_attendance";

  return `postgresql://${user}:${password}@127.0.0.1:5432/${database}`;
}

export function resolveRedisUrl(defaultDatabaseNumber) {
  if (process.env.TEST_REDIS_URL) {
    return process.env.TEST_REDIS_URL;
  }

  if (process.env.REDIS_URL) {
    const url = new URL(rewriteDockerHostname(process.env.REDIS_URL, "redis:"));

    if (!url.pathname || url.pathname === "/") {
      url.pathname = `/${defaultDatabaseNumber}`;
    }

    return url.toString();
  }

  return `redis://127.0.0.1:6379/${defaultDatabaseNumber}`;
}

export function resolveMinioEndpoint() {
  const endpoint = process.env.MINIO_ENDPOINT || "127.0.0.1:9000";
  const url = toUrl(endpoint, "http:");

  if (url.hostname === "minio") {
    url.hostname = "127.0.0.1";
  }

  return url.port ? `${url.hostname}:${url.port}` : url.hostname;
}
