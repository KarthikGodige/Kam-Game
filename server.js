const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const PORT = 3000;
const ROOT = __dirname;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mp3': 'audio/mpeg',
  '.mpeg': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.woff2': 'font/woff2'
};

function send(res, code, msg) {
  res.writeHead(code, { 'Content-Type': 'text/plain' });
  res.end(msg);
}

const server = http.createServer((req, res) => {
  let reqPath;
  try {
    reqPath = decodeURIComponent(req.url.split('?')[0]);
  } catch {
    return send(res, 400, '400 Bad Request');
  }
  if (reqPath === '/' || reqPath === '') reqPath = '/index.html';

  // Block path traversal (e.g. /../secret.txt)
  const filePath = path.normalize(path.join(ROOT, reqPath));
  if (filePath !== ROOT && !filePath.startsWith(ROOT + path.sep)) {
    return send(res, 403, '403 Forbidden');
  }

  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) return send(res, 404, '404 Not Found');

    const ext = path.extname(filePath).toLowerCase();
    const headers = {
      'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
      'Accept-Ranges': 'bytes'
    };

    // Range support: needed for video seeking/looping in Chrome, Safari, mobile
    const range = req.headers.range;
    if (range) {
      const m = /^bytes=(\d*)-(\d*)$/.exec(range);
      if (!m) return send(res, 416, '416 Range Not Satisfiable');
      let start = m[1] === '' ? stat.size - parseInt(m[2], 10) : parseInt(m[1], 10);
      let end = m[1] !== '' && m[2] !== '' ? parseInt(m[2], 10) : stat.size - 1;
      if (isNaN(start) || start < 0) start = 0;
      if (end >= stat.size) end = stat.size - 1;
      if (start > end) {
        res.writeHead(416, { 'Content-Range': `bytes */${stat.size}` });
        return res.end();
      }
      res.writeHead(206, {
        ...headers,
        'Content-Range': `bytes ${start}-${end}/${stat.size}`,
        'Content-Length': end - start + 1
      });
      return fs.createReadStream(filePath, { start, end }).pipe(res);
    }

    res.writeHead(200, { ...headers, 'Content-Length': stat.size });
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, () => {
  const url = `http://localhost:${PORT}`;
  console.log(`\n========================================`);
  console.log(`🚀 Bro's Downfall Game Running at: ${url}`);
  console.log(`========================================\n`);

  const openCmd = process.platform === 'win32' ? `start "" "${url}"` : `open "${url}"`;
  exec(openCmd, () => {});
});