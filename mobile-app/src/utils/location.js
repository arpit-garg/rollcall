const MAX_GPS_ACCURACY_METRES = 30;
const DEFAULT_LOCATION_FIX_ATTEMPTS = 5;
const DEFAULT_LOCATION_FIX_DELAY_MS = 1200;

function delay(ms) {
  if (ms <= 0) {
    return Promise.resolve();
  }

  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getHighAccuracyMode(Location) {
  return (
    Location.Accuracy?.BestForNavigation ??
    Location.Accuracy?.Highest ??
    Location.Accuracy?.High ??
    Location.Accuracy?.Balanced
  );
}

function normalizeLocationFix(location) {
  const latitude = Number(location?.coords?.latitude);
  const longitude = Number(location?.coords?.longitude);
  const accuracy = Number(location?.coords?.accuracy);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw new Error("Location coordinates are unavailable. Step outside and re-try.");
  }

  if (!Number.isFinite(accuracy)) {
    throw new Error("Location accuracy is unavailable. Step outside and re-try.");
  }

  return {
    latitude,
    longitude,
    accuracy
  };
}

function formatCoordinates(fix) {
  return `${fix.latitude.toFixed(6)}, ${fix.longitude.toFixed(6)}`;
}

async function getBestLocationFix(
  Location,
  {
    attempts = DEFAULT_LOCATION_FIX_ATTEMPTS,
    delayMs = DEFAULT_LOCATION_FIX_DELAY_MS,
    maxAccuracyMetres = MAX_GPS_ACCURACY_METRES,
    onFix = () => {}
  } = {}
) {
  await Location.enableNetworkProviderAsync?.().catch(() => null);

  const highAccuracyMode = getHighAccuracyMode(Location);
  let bestFix = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const location = await Location.getCurrentPositionAsync({
      accuracy: highAccuracyMode,
      mayShowUserSettingsDialog: true
    });
    const fix = normalizeLocationFix(location);

    if (!bestFix || fix.accuracy < bestFix.accuracy) {
      bestFix = fix;
    }

    onFix(fix, {
      attempt,
      attempts,
      bestFix,
      maxAccuracyMetres
    });

    if (fix.accuracy <= maxAccuracyMetres) {
      return fix;
    }

    if (attempt < attempts) {
      await delay(delayMs);
    }
  }

  throw new Error(
    `Location accuracy (${Math.round(bestFix.accuracy)}m) too low at ${formatCoordinates(bestFix)} after ${attempts} attempts. ` +
      "Step outside, enable precise/high-accuracy location, and re-try."
  );
}

module.exports = {
  MAX_GPS_ACCURACY_METRES,
  getBestLocationFix
};
