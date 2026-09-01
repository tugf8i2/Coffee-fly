export function isPowerConserving({ batteryLevel = -1, lowPowerMode = false } = {}) {
  return Boolean(lowPowerMode) || (batteryLevel >= 0 && batteryLevel <= 0.2);
}

export function trackingIntervals(power = {}) {
  const conserving = isPowerConserving(power);
  return {
    conserving,
    timeInterval: conserving ? 30000 : 15000,
    distanceInterval: conserving ? 25 : 10,
    deferredUpdatesDistance: conserving ? 100 : 50,
    deferredUpdatesInterval: conserving ? 60000 : 30000,
  };
}
