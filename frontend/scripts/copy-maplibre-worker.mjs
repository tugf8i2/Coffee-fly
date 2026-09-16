import { copyFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const distribution = resolve(projectRoot, 'node_modules/maplibre-gl/dist');
const publicDirectory = resolve(projectRoot, 'public');
// MapLibre 6 usa un worker ESM que importa este módulo compartido relativo.
// Ambos archivos deben proceder de la misma versión y publicarse juntos.
await mkdir(publicDirectory, { recursive: true });
for (const [source, destination] of [
  ['maplibre-gl-worker.mjs', 'maplibre-gl-csp-worker.js'],
  ['maplibre-gl-shared.mjs', 'maplibre-gl-shared.mjs'],
]) {
  await copyFile(resolve(distribution, source), resolve(publicDirectory, destination));
  console.log(`MapLibre listo: ${destination}`);
}
