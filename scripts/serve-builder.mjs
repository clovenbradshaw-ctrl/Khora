// Serves the repo root over plain HTTP so the App Builder's ES module
// imports (index.html's app.js -> ./src/...) resolve — browsers won't run
// cross-file module imports over file://. No new dependency: Node's
// built-in http/fs cover a page-view static server; this is not a production
// server and binds to localhost only.

import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT) || 8420;

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
};

const server = http.createServer(async (req, res) => {
  try {
    const urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    let filePath = path.join(ROOT, urlPath === '/' ? '/index.html' : urlPath);
    if (!filePath.startsWith(ROOT)) {
      res.writeHead(403).end('forbidden');
      return;
    }
    const info = await stat(filePath).catch(() => null);
    if (info?.isDirectory()) filePath = path.join(filePath, 'index.html');

    const body = await readFile(filePath);
    const type = CONTENT_TYPES[path.extname(filePath)] ?? 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type }).end(body);
  } catch {
    res.writeHead(404).end('not found');
  }
});

server.listen(PORT, () => {
  console.log(`App Builder: http://localhost:${PORT}/`);
});
