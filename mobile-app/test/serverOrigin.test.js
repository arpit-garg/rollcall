const assert = require("node:assert/strict");
const { test } = require("node:test");

const {
  buildApiUrl,
  getDefaultServerOriginFromRuntime,
  resolveStoredServerOrigin
} = require("../src/api/serverOrigin.js");

test("uses the Expo bundle host as the default server origin on a physical device", () => {
  const origin = getDefaultServerOriginFromRuntime({
    platformOS: "android",
    platformConstants: {
      Brand: "samsung",
      Model: "SM-A546E",
      Fingerprint: "samsung/a54/a54:14"
    },
    sourceCodeScriptUrl: "http://192.168.1.37:8081/index.bundle?platform=android"
  });

  assert.equal(origin, "http://192.168.1.37");
});

test("normalizes Expo protocol bundle URLs to an HTTP server origin", () => {
  const origin = getDefaultServerOriginFromRuntime({
    platformOS: "android",
    platformConstants: {
      Brand: "samsung",
      Model: "SM-A546E",
      Fingerprint: "samsung/a54/a54:14"
    },
    sourceCodeScriptUrl: "exp://192.168.1.37:8081"
  });

  assert.equal(origin, "http://192.168.1.37");
});

test("uses SourceCode constants URLs before falling back to Android defaults", () => {
  const origin = getDefaultServerOriginFromRuntime({
    platformOS: "android",
    platformConstants: {
      Brand: "samsung",
      Model: "SM-A546E",
      Fingerprint: "samsung/a54/a54:14"
    },
    sourceUrls: [null, "exp://192.168.1.37:8081"]
  });

  assert.equal(origin, "http://192.168.1.37");
});

test("does not use localhost config on a physical Android device", () => {
  const origin = getDefaultServerOriginFromRuntime({
    configOrigin: "http://localhost",
    platformOS: "android",
    platformConstants: {
      Brand: "samsung",
      Model: "SM-A546E",
      Fingerprint: "samsung/a54/a54:14"
    },
    sourceCodeScriptUrl: "exp://192.168.1.37:8081"
  });

  assert.equal(origin, "http://192.168.1.37");
});

test("does not classify unknown Android constants as an emulator without emulator model signals", () => {
  const origin = getDefaultServerOriginFromRuntime({
    platformOS: "android",
    platformConstants: {
      Brand: "unknown",
      Model: "SM-A546E",
      Fingerprint: "unknown"
    },
    sourceUrls: ["exp://192.168.1.37:8081"]
  });

  assert.equal(origin, "http://192.168.1.37");
});

test("keeps Android emulator traffic on the emulator host loopback", () => {
  const origin = getDefaultServerOriginFromRuntime({
    platformOS: "android",
    platformConstants: {
      Brand: "generic",
      Model: "sdk_gphone64_x86_64",
      Fingerprint: "generic/sdk_gphone64_x86_64"
    },
    sourceCodeScriptUrl: "http://10.0.2.2:8081/index.bundle?platform=android"
  });

  assert.equal(origin, "http://10.0.2.2");
});

test("replaces a stored emulator origin when the runtime default is a LAN host", () => {
  assert.equal(
    resolveStoredServerOrigin({
      storedOrigin: "http://10.0.2.2",
      defaultOrigin: "http://192.168.1.37"
    }),
    "http://192.168.1.37"
  );
});

test("replaces a stale stored LAN origin with the current Expo host", () => {
  assert.equal(
    resolveStoredServerOrigin({
      storedOrigin: "http://192.168.1.65",
      defaultOrigin: "http://192.168.1.37"
    }),
    "http://192.168.1.37"
  );
});

test("builds gateway API URLs with port 8080 for LAN origins", () => {
  assert.equal(
    buildApiUrl("http://192.168.1.37", "/attendance/current-window"),
    "http://192.168.1.37:8080/api/v1/attendance/current-window"
  );
});
