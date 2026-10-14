const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const handlers = {};
const entries = new Map();
let online = true;
let networkCalls = 0;
const cache = {
  match: async (request) => entries.get(request.url),
  put: async (request, response) => { entries.set(request.url, response); },
  keys: async () => [...entries.keys()].map((url) => ({ url })),
  delete: async (request) => entries.delete(request.url),
};
const context = {
  URL,
  self: {
    location: { origin: 'https://coffee-fly.hostless.app' },
    addEventListener: (name, handler) => { handlers[name] = handler; },
  },
  caches: { open: async () => cache },
  fetch: async () => {
    networkCalls += 1;
    if (!online) throw new Error('No network');
    return { ok: true, clone() { return this; }, body: 'map tile' };
  },
};
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../public/sw.js'), 'utf8'), context);

async function request(url) {
  let response;
  handlers.fetch({
    request: { url, method: 'GET', destination: 'image', mode: 'cors' },
    respondWith: (promise) => { response = promise; },
  });
  return response;
}

(async () => {
  const tile = 'https://tiles.openfreemap.org/planet/12/1234/2345.pbf';
  assert.equal((await request(tile)).body, 'map tile');
  online = false;
  assert.equal((await request(tile)).body, 'map tile');
  assert.equal(networkCalls, 1, 'A viewed map tile must work without another network request');
  await assert.rejects(request('https://tiles.openfreemap.org/planet/12/1234/2346.pbf'), /No network/);
  console.log('Map resources previously viewed remain available offline.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
