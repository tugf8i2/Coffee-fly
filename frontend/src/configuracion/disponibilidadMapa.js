export const isNativeMapAvailable = (platform, googleMapsConfigured, runningInExpoGo = false) => (
  platform !== 'android' || Boolean(googleMapsConfigured) || runningInExpoGo
);
