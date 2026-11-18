const { createServer } = require('node:http');
const { readFileSync, readdirSync } = require('node:fs');
const { join } = require('node:path');

const home = readFileSync(join(__dirname, 'index.html'));
const games = readFileSync(join(__dirname, 'games.html'));
const booth = readFileSync(join(__dirname, 'photo-booth.html'));
const runner = readFileSync(join(__dirname, 'runner.html'));
const characters = readFileSync(join(__dirname, 'characters.html'));
const pages = new Map([['/', home], ['/index.html', home], ['/games.html', games], ['/photo-booth.html', booth], ['/runner.html', runner], ['/characters.html', characters]]);
const photos = new Map(
  readdirSync(join(__dirname, 'photos'))
    .filter(name => name.endsWith('.jpg'))
    .map(name => ['/photos/' + name, readFileSync(join(__dirname, 'photos', name))])
);
const appFiles = new Map([
  ['/manifest.webmanifest', 'application/manifest+json'],
  ['/pwa.js', 'text/javascript; charset=utf-8'],
  ['/sw.js', 'text/javascript; charset=utf-8'],
  ['/icons/zohan-192.png', 'image/png'],
  ['/icons/zohan-512.png', 'image/png']
].map(([path, type]) => [path, { type, body: readFileSync(join(__dirname, path.slice(1))) }]));
const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? '0.0.0.0';

createServer((request, response) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { Allow: 'GET, HEAD' }).end();
    return;
  }
  const path = request.url.split('?')[0];
  const photo = photos.get(path);
  const appFile = appFiles.get(path);
  const body = photo ?? appFile?.body ?? pages.get(path);
  if (!body) {
    response.writeHead(404).end();
    return;
  }
  response.writeHead(200, {
    'Content-Type': appFile?.type ?? (photo ? 'image/jpeg' : 'text/html; charset=utf-8'),
    'Content-Length': body.length,
    ...(path === '/sw.js' ? { 'Cache-Control': 'no-cache' } : {})
  });
  response.end(request.method === 'HEAD' ? undefined : body);
}).listen(port, host, () => console.log('Zohan’s World is listening'));
