const CACHE = 'small-start-v13';
const SHELL = ['./', './index.html', './styles.css', './app.js', './timer.js', './manifest.webmanifest', './icons/icon.svg', './icons/icon-192.png', './icons/icon-512.png', './fonts/dm-sans-400.ttf', './fonts/dm-sans-700.ttf', './fonts/manrope-700.ttf', './fonts/manrope-800.ttf'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => Promise.all(SHELL.map(async path => {
    const url = new URL(path, self.registration.scope);
    const fresh = new URL(url);
    fresh.searchParams.set('release', CACHE);
    const response = await fetch(fresh, { cache: 'reload' });
    if (!response.ok) throw new Error(`Precache failed: ${path}`);
    await cache.put(url, response);
  }))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => { event.waitUntil(Promise.all([caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))), self.clients.claim()])); });
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).catch(() => caches.match(new URL('./index.html', self.registration.scope))));
  } else {
    event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request)));
  }
});
