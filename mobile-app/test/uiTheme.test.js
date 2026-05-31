const assert = require("node:assert/strict");
const { test } = require("node:test");

const {
  getPressedScaleStyle,
  getSurfaceShadowStyle,
  getTonePalette
} = require("../src/utils/uiTheme.js");

test("getPressedScaleStyle returns a stable tactile press state", () => {
  assert.equal(getPressedScaleStyle(false), null);
  assert.equal(getPressedScaleStyle(true, { disabled: true }), null);
  assert.deepEqual(getPressedScaleStyle(true), {
    opacity: 0.92,
    transform: [{ scale: 0.97 }]
  });
});

test("getSurfaceShadowStyle maps raised surfaces per platform", () => {
  assert.deepEqual(getSurfaceShadowStyle("raised", "android"), {
    elevation: 8
  });

  assert.deepEqual(getSurfaceShadowStyle("raised", "ios"), {
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.22,
    shadowRadius: 24
  });
});

test("getTonePalette falls back to a neutral tone for unknown values", () => {
  assert.equal(getTonePalette("success").accent, "#34d399");
  assert.deepEqual(getTonePalette("unknown"), getTonePalette("neutral"));
});
