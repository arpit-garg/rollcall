const assert = require("node:assert/strict");
const { test } = require("node:test");
const { getBestLocationFix } = require("../src/utils/location.js");

test("getBestLocationFix retries until it receives an acceptable GPS accuracy", async () => {
  const calls = [];
  const updates = [];
  const fixes = [
    { coords: { latitude: 31.3991, longitude: 75.5361, accuracy: 100 } },
    { coords: { latitude: 31.3993, longitude: 75.5363, accuracy: 55 } },
    { coords: { latitude: 31.3996, longitude: 75.5366, accuracy: 18 } }
  ];
  const Location = {
    Accuracy: {
      BestForNavigation: 6,
      Highest: 5,
      High: 4,
      Balanced: 3
    },
    enableNetworkProviderAsync: async () => {},
    getCurrentPositionAsync: async (options) => {
      calls.push(options);
      return fixes[calls.length - 1];
    }
  };

  const fix = await getBestLocationFix(Location, {
    delayMs: 0,
    onFix: (nextFix) => updates.push(nextFix)
  });

  assert.equal(fix.accuracy, 18);
  assert.equal(fix.latitude, 31.3996);
  assert.equal(fix.longitude, 75.5366);
  assert.equal(calls.length, 3);
  assert.deepEqual(
    updates.map((update) => update.accuracy),
    [100, 55, 18]
  );
  assert.ok(calls.every((call) => call.accuracy === Location.Accuracy.BestForNavigation));
});

test("getBestLocationFix reports the best coordinates when every GPS fix is too coarse", async () => {
  const Location = {
    Accuracy: {
      BestForNavigation: 6
    },
    enableNetworkProviderAsync: async () => {},
    getCurrentPositionAsync: async () => ({
      coords: { latitude: 31.3996, longitude: 75.5366, accuracy: 100 }
    })
  };

  await assert.rejects(
    async () => {
      try {
        await getBestLocationFix(Location, {
          attempts: 2,
          delayMs: 0
        });
      } catch (error) {
        assert.match(error.message, /31\.399600, 75\.536600/);
        assert.match(error.message, /100m/);
        throw error;
      }
    },
    /too low/
  );
});
