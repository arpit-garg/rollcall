import { Platform } from "react-native";

const DEFAULT_ANDROID_ORIGIN = "http://10.0.2.2";
const DEFAULT_LOCAL_ORIGIN = "http://localhost";

function ensureProtocol(value) {
  if (value.startsWith("http://") || value.startsWith("https://")) {
    return value;
  }

  return `http://${value}`;
}

export function getDefaultServerOrigin() {
  return Platform.OS === "android" ? DEFAULT_ANDROID_ORIGIN : DEFAULT_LOCAL_ORIGIN;
}

export function normalizeServerOrigin(value) {
  const trimmed = value.trim();

  if (!trimmed) {
    return getDefaultServerOrigin();
  }

  return ensureProtocol(trimmed).replace(/\/$/, "");
}

function buildUrl(origin, port, path) {
  const base = normalizeServerOrigin(origin);
  return `${base}:${port}/api/v1${path.startsWith("/") ? path : `/${path}`}`;
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

async function request(origin, port, path, options = {}) {
  const response = await fetch(buildUrl(origin, port, path), options);
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

export function authRequest(origin, path, options = {}) {
  return request(origin, 3001, path, options);
}

export function attendanceRequest(origin, path, options = {}) {
  return request(origin, 3002, path, options);
}
