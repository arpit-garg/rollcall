const DEFAULT_ANDROID_ORIGIN = "http://10.0.2.2";
const DEFAULT_LOCAL_ORIGIN = "http://localhost";

function ensureProtocol(value) {
  if (value.startsWith("http://") || value.startsWith("https://") || value.startsWith("exp://")) {
    return value;
  }

  return `http://${value}`;
}

function parseOrigin(value) {
  const match = String(value || "").match(/^(https?:\/\/|exp:\/\/)(\[[^\]]+\]|[^/:?#]+)(?::\d+)?(?:[/?#]|$)/i);

  if (!match) {
    return null;
  }

  return {
    protocol: match[1].toLowerCase() === "exp://" ? "http://" : match[1].toLowerCase(),
    host: match[2].toLowerCase()
  };
}

function normalizeServerOrigin(value, fallbackOrigin = DEFAULT_LOCAL_ORIGIN) {
  const trimmed = String(value || "").trim();

  if (!trimmed) {
    return fallbackOrigin;
  }

  const origin = parseOrigin(ensureProtocol(trimmed));

  if (!origin) {
    return ensureProtocol(trimmed).replace(/\/$/, "").replace(/:\d+$/, "");
  }

  return `${origin.protocol}${origin.host}`;
}

function isAndroidEmulator(constants = {}) {
  const brand = String(constants.Brand || "").toLowerCase();
  const model = String(constants.Model || "").toLowerCase();
  const fingerprint = String(constants.Fingerprint || "").toLowerCase();

  return (
    brand.startsWith("generic") ||
    fingerprint.startsWith("generic") ||
    model.includes("google_sdk") ||
    model.includes("emulator") ||
    model.includes("android sdk built for x86") ||
    model.includes("sdk_gphone")
  );
}

function getHost(origin) {
  return parseOrigin(origin)?.host || "";
}

function isLoopbackOrigin(origin) {
  const host = getHost(origin);
  return host === "localhost" || host === "127.0.0.1" || host === "10.0.2.2";
}

function isIpHost(host) {
  return /^\d{1,3}(?:\.\d{1,3}){3}$/.test(host);
}

function isPrivateLanHost(host) {
  if (!isIpHost(host)) {
    return false;
  }

  const [first, second] = host.split(".").map(Number);
  return first === 10 || (first === 172 && second >= 16 && second <= 31) || (first === 192 && second === 168);
}

function isLocalDevelopmentOrigin(origin) {
  const host = getHost(origin);
  return isLoopbackOrigin(origin) || isPrivateLanHost(host);
}

function inferServerOriginFromRuntimeUrl(value) {
  const origin = parseOrigin(ensureProtocol(String(value || "").trim()));

  if (!origin) {
    return null;
  }

  return `${origin.protocol}${origin.host}`;
}

function inferServerOriginFromRuntimeUrls(values = []) {
  const origins = values.map(inferServerOriginFromRuntimeUrl).filter(Boolean);
  return origins.find((origin) => !isLoopbackOrigin(origin)) || origins[0] || null;
}

function getDefaultServerOriginFromRuntime({
  configOrigin,
  platformOS,
  platformConstants,
  sourceCodeScriptUrl,
  sourceUrls = []
} = {}) {
  const emulator = platformOS === "android" && isAndroidEmulator(platformConstants);
  const bundleOrigin = inferServerOriginFromRuntimeUrls([sourceCodeScriptUrl, ...sourceUrls]);

  if (configOrigin) {
    const normalizedConfigOrigin = normalizeServerOrigin(configOrigin);
    const host = getHost(normalizedConfigOrigin);

    if (emulator && (host === "localhost" || host === "127.0.0.1")) {
      return DEFAULT_ANDROID_ORIGIN;
    }

    if (!emulator && isLoopbackOrigin(normalizedConfigOrigin) && bundleOrigin && !isLoopbackOrigin(bundleOrigin)) {
      return bundleOrigin;
    }

    return normalizedConfigOrigin;
  }

  if (bundleOrigin) {
    const host = getHost(bundleOrigin);

    if (emulator && (host === "localhost" || host === "127.0.0.1")) {
      return DEFAULT_ANDROID_ORIGIN;
    }

    return bundleOrigin;
  }

  return platformOS === "android" ? DEFAULT_ANDROID_ORIGIN : DEFAULT_LOCAL_ORIGIN;
}

function resolveStoredServerOrigin({ storedOrigin, defaultOrigin } = {}) {
  const normalizedDefaultOrigin = normalizeServerOrigin(defaultOrigin, DEFAULT_LOCAL_ORIGIN);

  if (!storedOrigin) {
    return normalizedDefaultOrigin;
  }

  const normalizedStoredOrigin = normalizeServerOrigin(storedOrigin, normalizedDefaultOrigin);

  if (
    isLocalDevelopmentOrigin(normalizedStoredOrigin) &&
    isLocalDevelopmentOrigin(normalizedDefaultOrigin) &&
    normalizedStoredOrigin !== normalizedDefaultOrigin
  ) {
    return normalizedDefaultOrigin;
  }

  return normalizedStoredOrigin;
}

function buildApiUrl(origin, path) {
  const base = normalizeServerOrigin(origin);
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  const host = getHost(base);
  const shouldUseGatewayPort = host === "localhost" || host === "10.0.2.2" || isIpHost(host);

  return shouldUseGatewayPort ? `${base}:8080/api/v1${cleanPath}` : `${base}/api/v1${cleanPath}`;
}

module.exports = {
  DEFAULT_ANDROID_ORIGIN,
  DEFAULT_LOCAL_ORIGIN,
  buildApiUrl,
  getDefaultServerOriginFromRuntime,
  inferServerOriginFromBundleUrl: inferServerOriginFromRuntimeUrl,
  normalizeServerOrigin,
  resolveStoredServerOrigin
};
