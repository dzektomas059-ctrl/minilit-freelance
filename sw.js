const CACHE = 'minilit-v2';
const STATIC_URLS = [
  '/minilit-freelance/',
  '/minilit-freelance/index.html',
  '/minilit-freelance/src/main.js',
  '/minilit-freelance/src/app.js',
  '/minilit-freelance/src/api.js',
  '/minilit-freelance/src/store.js',
  '/minilit-freelance/src/router.js',
  '/minilit-freelance/src/i18n.js',
  '/minilit-freelance/src/styles.css',
  '/minilit-freelance/src/views/profile.js',
  '/minilit-freelance/src/views/chat.js',
  '/minilit-freelance/src/views/admin.js',
  '/minilit-freelance/manifest.json',
];
const API_HOSTS = ['supabase.co', 'api.resend.com'];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(STATIC_URLS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(names => Promise.all(names.filter(n => n !== CACHE).map(n => caches.delete(n)))).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  
  if (event.request.method !== 'GET') return;
  
  if (API_HOSTS.some(h => url.hostname.includes(h)) || url.pathname.includes('/rest/v1/')) {
    event.respondWith(networkOnly(event.request));
    return;
  }
  
  if (event.request.mode === 'navigate') {
    event.respondWith(networkFirst(event.request));
    return;
  }
  
  event.respondWith(cacheFirst(event.request));
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok && response.type === 'basic') {
      const clone = response.clone();
      (await caches.open(CACHE)).put(request, clone);
    }
    return response;
  } catch (e) {
    return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
  }
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const clone = response.clone();
      (await caches.open(CACHE)).put(request, clone);
    }
    return response;
  } catch (e) {
    const cached = await caches.match(request);
    if (cached) return cached;
    return caches.match('/minilit-freelance/index.html');
  }
}

async function networkOnly(request) {
  try {
    return await fetch(request);
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Network unavailable' }), {
      status: 503, headers: { 'Content-Type': 'application/json' }
    });
  }
}

self.addEventListener('push', event => {
  let data;
  try { data = event.data ? event.data.json() : {}; }
  catch (_) { data = { title: 'MiniLIT', body: event.data?.text() || '' }; }
  const title = data.title || 'MiniLIT';
  const options = {
    body: data.body || '',
    icon: '/minilit-freelance/icons/icon-192.svg',
    badge: '/minilit-freelance/icons/icon-192.svg',
    data: data.data || {},
    vibrate: [200, 100, 200],
    requireInteraction: true,
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const urlToOpen = event.notification.data?.link || '/minilit-freelance/';
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(clients => {
      for (const client of clients) {
        if (client.url.includes('minilit-freelance') && 'focus' in client) {
          client.postMessage({ type: 'NAVIGATE', url: urlToOpen });
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(urlToOpen);
    })
  );
});
