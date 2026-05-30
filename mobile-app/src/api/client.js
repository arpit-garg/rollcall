import { Platform } from "react-native";
import appConfig from "../../app.json";

const ENV_SERVER_ORIGIN =
  typeof process !== "undefined"
    ? process.env?.EXPO_PUBLIC_SERVER_ORIGIN || process.env?.MOBILE_DEFAULT_SERVER_ORIGIN
    : undefined;
const CONFIG_SERVER_ORIGIN = ENV_SERVER_ORIGIN || appConfig?.expo?.extra?.defaultServerOrigin;
const DEFAULT_ANDROID_ORIGIN = "http://10.0.2.2";
const DEFAULT_LOCAL_ORIGIN = "http://localhost";

function ensureProtocol(value) {
  if (value.startsWith("http://") || value.startsWith("https://")) {
    return value;
  }

  return `http://${value}`;
}

export function getDefaultServerOrigin() {
  if (CONFIG_SERVER_ORIGIN) {
    if (Platform.OS === "android") {
      const constants = Platform.constants || {};
      const brand = (constants.Brand || "").toLowerCase();
      const model = (constants.Model || "").toLowerCase();
      const fingerprint = (constants.Fingerprint || "").toLowerCase();
      
      const isEmulator = 
        brand.startsWith("generic") ||
        brand.startsWith("unknown") ||
        fingerprint.startsWith("generic") ||
        fingerprint.startsWith("unknown") ||
        model.includes("google_sdk") ||
        model.includes("emulator") ||
        model.includes("android sdk built for x86") ||
        model.includes("sdk_gphone");
        
      const isLocalConfigOrigin =
        CONFIG_SERVER_ORIGIN.includes("localhost") ||
        CONFIG_SERVER_ORIGIN.includes("127.0.0.1") ||
        /https?:\/\/\d+\.\d+\.\d+\.\d+/.test(CONFIG_SERVER_ORIGIN);
        
      if (isEmulator && isLocalConfigOrigin) {
        console.log("[API] Android Emulator detected. Automatically routing to loopback IP:", DEFAULT_ANDROID_ORIGIN);
        return DEFAULT_ANDROID_ORIGIN;
      }
    }
    return CONFIG_SERVER_ORIGIN;
  }
  return Platform.OS === "android" ? DEFAULT_ANDROID_ORIGIN : DEFAULT_LOCAL_ORIGIN;
}

export function normalizeServerOrigin(value) {
  const trimmed = value.trim();

  if (!trimmed) {
    return getDefaultServerOrigin();
  }

  // Strip any trailing port number so buildUrl can always append :8080 cleanly.
  // e.g. "http://192.168.1.65:8080" → "http://192.168.1.65"
  return ensureProtocol(trimmed)
    .replace(/\/$/, "")
    .replace(/:\d+$/, "");
}

function buildUrl(origin, path) {
  const base = normalizeServerOrigin(origin);
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  // Don't append :8080 for public tunnel URLs (https:// with a hostname, not an IP).
  // For local IPs or localhost, always use port 8080.
  const isLocalOrigin =
    base.includes("localhost") ||
    base.includes("10.0.2.2") ||
    /https?:\/\/\d+\.\d+\.\d+\.\d+/.test(base);
  const url = isLocalOrigin
    ? `${base}:8080/api/v1${cleanPath}`
    : `${base}/api/v1${cleanPath}`;
  console.log("[API] \u2192", url);
  return url;
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

async function request(origin, path, options = {}) {
  const response = await fetch(buildUrl(origin, path), {
    ...options,
    headers: {
      "bypass-tunnel-reminder": "true",
      ...(options.headers || {})
    }
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

export function authRequest(origin, path, options = {}) {
  return request(origin, path, options);
}

export function attendanceRequest(origin, path, options = {}) {
  return request(origin, path, options);
}
