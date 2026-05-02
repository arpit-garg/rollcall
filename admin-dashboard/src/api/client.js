const DEFAULT_AUTH_API_BASE_URL = "http://localhost:3001/api/v1";
const DEFAULT_ATTENDANCE_API_BASE_URL = "http://localhost:3002/api/v1";

function buildUrl(baseUrl, path) {
  const normalizedBaseUrl = baseUrl.replace(/\/$/, "");
  return `${normalizedBaseUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

async function parseBody(response) {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch (_error) {
    return {
      error: {
        code: "INVALID_JSON",
        message: text,
        retryable: false
      }
    };
  }
}

async function request(baseUrl, path, options = {}) {
  const response = await fetch(buildUrl(baseUrl, path), {
    credentials: "include",
    ...options
  });
  const body = await parseBody(response);

  if (!response.ok) {
    const error = new Error(body?.error?.message || `Request failed with status ${response.status}`);
    error.status = response.status;
    error.code = body?.error?.code || "REQUEST_FAILED";
    error.retryable = body?.error?.retryable ?? false;
    error.body = body;
    throw error;
  }

  return body;
}

export function authRequest(path, options = {}) {
  return request(import.meta.env.VITE_AUTH_API_BASE_URL || DEFAULT_AUTH_API_BASE_URL, path, options);
}

export function attendanceRequest(path, options = {}) {
  return request(
    import.meta.env.VITE_ATTENDANCE_API_BASE_URL || DEFAULT_ATTENDANCE_API_BASE_URL,
    path,
    options
  );
}
