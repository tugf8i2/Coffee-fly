const { withAndroidManifest, withDangerousMod } = require('@expo/config-plugins');
const fs = require('node:fs');
const path = require('node:path');

const withLocalHttp = (config) => withAndroidManifest(config, (mod) => {
  mod.modResults.manifest.application[0].$['android:usesCleartextTraffic'] = 'true';
  if (process.env.COFFEE_FLY_LOCAL_TEST_CA_CERT) {
    mod.modResults.manifest.application[0].$['android:networkSecurityConfig'] = '@xml/cf_local_network_security';
  }
  return mod;
});

const withLocalCertificate = (config) => withDangerousMod(config, ['android', async (mod) => {
  const certificate = process.env.COFFEE_FLY_LOCAL_TEST_CA_CERT;
  if (!certificate) return mod;
  const resources = path.join(mod.modRequest.platformProjectRoot, 'app', 'src', 'main', 'res');
  fs.mkdirSync(path.join(resources, 'raw'), { recursive: true });
  fs.mkdirSync(path.join(resources, 'xml'), { recursive: true });
  fs.copyFileSync(certificate, path.join(resources, 'raw', 'cf_local_dev_ca.crt'));
  fs.writeFileSync(path.join(resources, 'xml', 'cf_local_network_security.xml'),
    '<network-security-config><base-config cleartextTrafficPermitted="true"><trust-anchors><certificates src="system"/><certificates src="@raw/cf_local_dev_ca"/></trust-anchors></base-config></network-security-config>');
  return mod;
}]);

module.exports = ({ config }) => {
  if (process.env.COFFEE_FLY_LOCAL_TEST !== '1') return config;
  return {
    ...config,
    name: 'Coffee Fly Pruebas',
    android: {
      ...config.android,
      package: 'com.coffeefly.mobile.dev',
    },
    plugins: [...(config.plugins || []), withLocalHttp, withLocalCertificate],
  };
};
