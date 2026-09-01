module.exports = ({ config }) => {
  const googleMapsApiKey = process.env.GOOGLE_MAPS_ANDROID_API_KEY
    || process.env.EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY
    || '';
  const androidConfig = config.android?.config || {};

  return {
    ...config,
    android: {
      ...config.android,
      ...(googleMapsApiKey ? {
        config: {
          ...androidConfig,
          googleMaps: { apiKey: googleMapsApiKey },
        },
      } : {}),
    },
    extra: {
      ...config.extra,
      googleMapsConfigured: Boolean(googleMapsApiKey),
    },
  };
};
