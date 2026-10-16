import { readdir, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const distribution = resolve(projectRoot, 'dist');

async function filesIn(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => {
    const file = join(directory, entry.name);
    return entry.isDirectory() ? filesIn(file) : [file];
  }));
  return nested.flat();
}

const files = await filesIn(distribution);
const assets = files
  .map((file) => `/${relative(distribution, file).split(sep).join('/')}`)
  .filter((url) => url.startsWith('/_expo/') || url.startsWith('/assets/') || [
    '/manifest.json', '/favicon.ico', '/pwa-icon.png', '/pwa-icon-maskable.png',
    '/maplibre-gl-csp-worker.js', '/maplibre-gl-shared.mjs',
  ].includes(url))
  .sort();

if (!assets.some((url) => url.startsWith('/_expo/static/js/web/'))
  || !assets.some((url) => url.startsWith('/_expo/static/css/'))) {
  throw new Error('El export web no contiene los archivos necesarios para iniciar sin conexión.');
}

await writeFile(join(distribution, 'offline-assets.json'), JSON.stringify(assets));
console.log(`Shell offline listo: ${assets.length} recursos estáticos.`);
