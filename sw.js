const cachePrefix = 'zohans-world-';
const cacheName = cachePrefix + 'v11';
const pages = new Map([
  ['/', '/'],
  ['/index.html', '/'],
  ['/games.html', '/games.html'],
  ['/sega-player.html', '/sega-player.html'],
  ['/sega-runner.html', '/sega-runner.html'],
  ['/balloon-pop.html', '/balloon-pop.html'],
  ['/balloon-duel.html', '/balloon-duel.html'],
  ['/photo-booth.html', '/photo-booth.html'],
  ['/runner.html', '/runner.html'],
  ['/characters.html', '/characters.html']
]);
const photos = [
  '/photos/tom-and-jerry.jpg',
  '/photos/animatronic-friends.jpg',
  '/photos/animatronic-bedtime.jpg',
  '/photos/team-sonic.jpg'
];
const assets = new Set([
  ...photos,
  '/manifest.webmanifest',
  '/icons/zohan-192.png',
  '/icons/zohan-512.png',
  '/pwa.js'
]);

self.addEventListener('install', event => {
  event.waitUntil(caches.open(cacheName).then(cache => cache.addAll([
    ...new Set(pages.values()),
    ...assets
  ])));
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith(cachePrefix) && name !== cacheName)
      .map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  const page = pages.get(url.pathname);
  if (request.mode === 'navigate' && page) {
    event.respondWith((async () => {
      try {
        return await fetch(request);
      } catch {
        const cache = await caches.open(cacheName);
        return (await cache.match(page)) ?? Response.error();
      }
    })());
    return;
  }

  if (assets.has(url.pathname)) {
    event.respondWith((async () => {
      const cache = await caches.open(cacheName);
      return (await cache.match(url.pathname)) ?? fetch(request);
    })());
  }
});
