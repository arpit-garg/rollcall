import { NativeModules, Platform } from "react-native";
import { getExpoGoProjectConfig } from "expo";
import appConfig from "../../app.json";
import {
  buildApiUrl,
  getDefaultServerOriginFromRuntime,
  normalizeServerOrigin as normalizeOrigin,
  resolveStoredServerOrigin as resolveStoredOrigin
} from "./serverOrigin";

const ENV_SERVER_ORIGIN =
  typeof process !== "undefined"
    ? process.env?.EXPO_PUBLIC_SERVER_ORIGIN || process.env?.MOBILE_DEFAULT_SERVER_ORIGIN
    : undefined;
const CONFIG_SERVER_ORIGIN = ENV_SERVER_ORIGIN || appConfig?.expo?.extra?.defaultServerOrigin;

function getExpoGoRuntimeConfig() {
  try {
    return getExpoGoProjectConfig?.() || {};
  } catch (_error) {
    return {};
  }
}

function getRuntimeSourceUrls() {
  const sourceCode = NativeModules?.SourceCode;
  const sourceCodeConstants = sourceCode?.getConstants?.() || {};
  const expoGoConfig = getExpoGoRuntimeConfig();

  return [
    sourceCodeConstants.scriptURL,
    sourceCode?.scriptURL,
    expoGoConfig.debuggerHost,
    expoGoConfig.logUrl,
    globalThis?.location?.href
  ].filter(Boolean);
}

export function getDefaultServerOrigin() {
  return getDefaultServerOriginFromRuntime({
    configOrigin: CONFIG_SERVER_ORIGIN,
    platformOS: Platform.OS,
    platformConstants: Platform.constants || {},
    sourceUrls: getRuntimeSourceUrls()
  });
}

export function normalizeServerOrigin(value) {
  return normalizeOrigin(value, getDefaultServerOrigin());
}

export function resolveStoredServerOrigin({ storedOrigin, defaultOrigin } = {}) {
  return resolveStoredOrigin({
    storedOrigin,
    defaultOrigin: defaultOrigin || getDefaultServerOrigin()
  });
}

function buildUrl(origin, path) {
  const url = buildApiUrl(normalizeServerOrigin(origin), path);
  console.log("[API] ->", url);
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
