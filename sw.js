const CACHE = 'minilit-v1';
const STATIC_URLS = [
  '/minilit-freelance/',
  '/minilit-freelance/index.html',
  '/minilit-freelance/src/app.js',
  '/minilit-freelance/src/api.js',
  '/minilit-freelance/src/store.js',
  '/minilit-freelance/src/router.js',
  '/minilit-freelance/src/i18n.js',
  '/minilit-freelance/src/views/profile.js',
  '/minilit-freelance/src/views/chat.js',
  '/minilit-freelance/src/views/admin.js',
  '/minilit-freelance/manifest.json',
  '/minilit-freelance/icons/icon-192.png',
  '/minilit-freelance/icons/icon-512.png',
  '/minilit-freelance/icons/apple-touch-icon.png',
  '/minilit-freelance/icons/favicon.ico',
];

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

// Cache First / Network Fallback
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  
  // Skip non-GET and Supabase API calls
  if (event.request.method !== 'GET' || url.hostname.endsWith('supabase.co')) {
    return;
  }
  
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        // Cache successful responses for static assets
        if (response.ok && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        // Offline fallback: return cached index.html for navigation
        if (event.request.mode === 'navigate') {
          return caches.match('/minilit-freelance/index.html');
        }
        return new Response('Offline', { status: 503 });
      });
    })
  );
});

// Push notification handler
self.addEventListener('push', event => {
  let data;
  try {
    data = event.data ? event.data.json() : {};
  } catch (_) {
    data = { title: 'MiniLIT', body: event.data?.text() || '' };
  }
  
  const title = data.title || 'MiniLIT';
  const options = {
    body: data.body || '',
    icon: '/minilit-freelance/icons/icon-192.png',
    badge: '/minilit-freelance/icons/icon-192.png',
    data: data.data || {},
    vibrate: [200, 100, 200],
    requireInteraction: true,
  };
  
  event.waitUntil(self.registration.showNotification(title, options));
});

// Notification click handler
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
