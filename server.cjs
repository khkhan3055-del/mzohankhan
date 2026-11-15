const { createServer } = require('node:http');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const page = readFileSync(join(__dirname, 'index.html'));
const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? '0.0.0.0';

const server = createServer((request, response) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { Allow: 'GET, HEAD' }).end();
    return;
  }

  const path = request.url.split('?')[0];
  if (path !== '/' && path !== '/index.html') {
    response.writeHead(404).end();
    return;
  }

  response.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Length': page.length
  });
  response.end(request.method === 'HEAD' ? undefined : page);
});

server.listen(port, host, () => {
  console.log(`Zohan’s World is listening on port ${server.address().port}`);
});
