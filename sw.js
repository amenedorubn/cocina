const CACHE = 'cocina-v2';
const SHELL = [
  './',
  'index.html',
  'cocina.html',
  'app.css',
  'manifest.webmanifest',
  'js/store.js',
  'js/theme.js',
  'js/home.js',
  'js/recipe.js',
  'js/gantt.js',
  'js/voice.js',
  'js/wakelock.js',
  'js/keepalive.js',
  'js/cook.js',
  'js/sw-register.js',
  'recetas/index.json',
  'recetas/curry-pollo.json',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-192-maskable.png',
  'icons/icon-512-maskable.png',
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;

  event.respondWith(
    caches.match(req).then(cached => {
      const network = fetch(req).then(res => {
        if (res && res.ok) caches.open(CACHE).then(c => c.put(req, res.clone()));
        return res;
      }).catch(() => cached);
      return cached || network;
    })
  );
});
