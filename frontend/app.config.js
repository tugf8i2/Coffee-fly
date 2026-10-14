module.exports = ({ config }) => {
  if (process.env.COFFEE_FLY_LOCAL_TEST !== '1') return config;
  return {
    ...config,
    name: 'Coffee Fly Pruebas',
    android: {
      ...config.android,
      package: 'com.coffeefly.mobile.dev',
    },
  };
};
