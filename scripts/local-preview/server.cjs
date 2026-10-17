const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../../frontend/dist');
const port = Number(process.env.COFFEE_FLY_PREVIEW_PORT || 8080);
const apiUrl = process.env.COFFEE_FLY_PREVIEW_API_URL || 'http://127.0.0.1:8000';
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.ttf': 'font/ttf', '.mjs': 'text/javascript' };

http.createServer(async (request, response) => {
  try {
    if (request.url.startsWith('/api/')) {
      const chunks = [];
      for await (const chunk of request) chunks.push(chunk);
      const upstream = await fetch(`${apiUrl}${request.url.slice(4)}`, {
        method: request.method,
        headers: Object.fromEntries(Object.entries(request.headers).filter(([key]) => ['authorization', 'content-type'].includes(key))),
        body: chunks.length ? Buffer.concat(chunks) : undefined,
      });
      response.writeHead(upstream.status, { 'content-type': upstream.headers.get('content-type') || 'application/json' });
      response.end(Buffer.from(await upstream.arrayBuffer()));
      return;
    }
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const candidate = path.resolve(root, '.' + pathname);
    const file = candidate.startsWith(root + path.sep) && fs.existsSync(candidate) && fs.statSync(candidate).isFile()
      ? candidate : path.join(root, 'index.html');
    response.writeHead(200, { 'content-type': mime[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(response);
  } catch (error) {
    response.writeHead(502);
    response.end(error.message);
  }
}).listen(port, '127.0.0.1');
