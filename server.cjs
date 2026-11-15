const { createServer } = require('node:http');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const home = readFileSync(join(__dirname, 'index.html'));
const games = readFileSync(join(__dirname, 'games.html'));
const pages = new Map([['/', home], ['/index.html', home], ['/games.html', games]]);
const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? '0.0.0.0';

createServer((request, response) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { Allow: 'GET, HEAD' }).end();
    return;
  }
  const page = pages.get(request.url.split('?')[0]);
  if (!page) {
    response.writeHead(404).end();
    return;
  }
  response.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Length': page.length
  });
  response.end(request.method === 'HEAD' ? undefined : page);
}).listen(port, host, () => console.log('Zohan’s World is listening'));
