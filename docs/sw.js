const CACHE = 'minilit-v1';
const STATIC = [
  '/minilit-freelance/',
  '/minilit-freelance/index.html',
  '/minilit-freelance/manifest.json',
];
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(STATIC)).then(() => self.skipWaiting())
  );
});
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
  );
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;
  if (url.pathname.includes('/minilit-freelance/')) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        const fetched = fetch(e.request).then(res => {
          if (res.ok) caches.open(CACHE).then(c => c.put(e.request, res.clone()));
          return res;
        }).catch(() => cached);
        return fetched;
      })
    );
  }
});
/* ----- push notifications ----- */
self.addEventListener('push', e => {
  let data;
  try { data = e.data ? e.data.json() : {}; } catch(_) { data = { title: 'MiniLIT', body: e.data?.text() || '' }; }
  const title = data.title || 'MiniLIT';
  const opts = {
    body: data.body || '',
    icon: data.icon || '/minilit-freelance/icons/icon-192.png',
    badge: '/minilit-freelance/icons/icon-192.png',
    data: { url: data.url || '/' },
  };
  e.waitUntil(self.registration.showNotification(title, opts));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = e.notification.data?.url || '/minilit-freelance/';
  e.waitUntil(clients.openWindow(url));
});
