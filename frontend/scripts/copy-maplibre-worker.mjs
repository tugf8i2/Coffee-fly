import { copyFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = resolve(projectRoot, 'node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs');
const destination = resolve(projectRoot, 'public/maplibre-gl-csp-worker.js');

await mkdir(dirname(destination), { recursive: true });
await copyFile(source, destination);
console.log(`MapLibre worker listo: ${destination}`);
