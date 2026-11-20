const { createServer } = require('node:http');
const { readFileSync, readdirSync } = require('node:fs');
const { join } = require('node:path');
const { handleDuel } = require('./balloon-duel.cjs');

const zooLink = `<a href="/zoo-animals.html" aria-label="Explore Zoo Animals" style="position:fixed;bottom:18px;right:18px;z-index:9999;padding:14px 20px;background:#087e6e;color:white;border:3px solid #fff;border-radius:50px;box-shadow:0 5px 20px #0004;font:800 16px system-ui,sans-serif;text-decoration:none">🦁 Zoo Animals</a>`;
const home = Buffer.from(readFileSync(join(__dirname, 'index.html'),'utf8').replace(/<\/body>/i, zooLink + '</body>'));
const games = readFileSync(join(__dirname, 'games.html'));
const booth = readFileSync(join(__dirname, 'photo-booth.html'));
const runner = readFileSync(join(__dirname, 'runner.html'));
const characters = readFileSync(join(__dirname, 'characters.html'));
const zooAnimals = readFileSync(join(__dirname, 'zoo-animals.html'));
const balloonPop = readFileSync(join(__dirname, 'balloon-pop.html'));
const balloonDuel = readFileSync(join(__dirname, 'balloon-duel.html'));
const segaPlayer = readFileSync(join(__dirname, 'sega-player.html'));
const segaRunner = readFileSync(join(__dirname, 'sega-runner.html'));
const pages = new Map([['/', home], ['/index.html', home], ['/games.html', games], ['/photo-booth.html', booth], ['/runner.html', runner], ['/characters.html', characters], ['/zoo-animals.html', zooAnimals], ['/balloon-pop.html', balloonPop], ['/balloon-duel.html', balloonDuel], ['/sega-player.html', segaPlayer], ['/sega-runner.html', segaRunner]]);
const photos = new Map(
  readdirSync(join(__dirname, 'photos'))
    .filter(name => name.endsWith('.jpg'))
    .map(name => ['/photos/' + name, readFileSync(join(__dirname, 'photos', name))])
);
const appFiles = new Map([
  ['/colorful.css', 'text/css; charset=utf-8'],
  ['/playful.css', 'text/css; charset=utf-8'],
  ['/manifest.webmanifest', 'application/manifest+json'],
  ['/pwa.js', 'text/javascript; charset=utf-8'],
  ['/sw.js', 'text/javascript; charset=utf-8'],
  ['/icons/zohan-192.png', 'image/png'],
  ['/icons/zohan-512.png', 'image/png']
].map(([path, type]) => [path, { type, body: readFileSync(join(__dirname, path.slice(1))) }]));
const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? '0.0.0.0';

createServer((request, response) => {
  const path = request.url.split('?')[0];
  if (path === '/api/duel' || path.startsWith('/api/duel/')) {
    void handleDuel(request, response, path);
    return;
  }
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { Allow: 'GET, HEAD' }).end();
    return;
  }
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
