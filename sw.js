const CACHE = 'cocina-v7';
const SHELL = [
  './',
  'index.html',
  'cocina.html',
  'app.css',
  'manifest.webmanifest',
  'js/store.js',
  'js/icons.js',
  'js/contrast.js',
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
  'recetas/albondigas-rigatoni.json',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-192-maskable.png',
  'icons/icon-512-maskable.png',
];

// Cloudflare Pages redirige /index.html -> / y /cocina.html -> /cocina. Chrome rechaza servir a una
// navegación una respuesta "redirected" (ERR_FAILED), así que se guarda y se sirve una copia limpia.
const clean = res => res.redirected
  ? res.blob().then(b => new Response(b, { status: 200, statusText: 'OK', headers: res.headers }))
  : res;

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.all(SHELL.map(u => fetch(u, { cache: 'reload' }).then(clean).then(res => {
        if (!res.ok) throw new Error(u + ' ' + res.status);
        return c.put(u, res);
      }))))
      .then(() => self.skipWaiting())
  );
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
  const nav = req.mode === 'navigate';

  event.respondWith((async () => {
    // Navegación: /cocina?id=x y /cocina.html?id=x comparten la misma página guardada.
    const cache = await caches.open(CACHE);
    let cached = await cache.match(req, { ignoreSearch: nav });
    if (!cached && nav) {
      const p = new URL(req.url).pathname;
      cached = await cache.match(p === '/' || p.endsWith('/') ? './' : p.endsWith('.html') ? p : p + '.html', { ignoreSearch: true });
    }
    const network = fetch(req).then(async res => {
      if (res && res.ok && !nav) cache.put(req, res.clone());
      else if (res && res.ok && nav) cache.put(new URL(req.url).pathname === '/' ? './' : req.url.split('?')[0], (await clean(res.clone())));
      return res;
    }).catch(() => cached);
    return cached ? clean(cached) : network;
  })());
});
