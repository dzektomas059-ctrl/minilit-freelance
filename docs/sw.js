/* MiniLIT — service worker
 *
 * Strategy:
 *   • Same-origin static assets (index.html, manifest, icons, this SW): cache-first
 *   • Supabase REST/Realtime/Storage (*.supabase.co, *.supabase.in): network-first
 *     with a 5s timeout; on failure fall back to the cached response (if any).
 *   • Anything else: network-first, fall back to cache, finally fall back to a
 *     friendly inline offline page for navigations.
 *
 * Version bumps invalidate old caches automatically.
 */

const VERSION = 'v4';
const STATIC_CACHE  = `minilit-static-${VERSION}`;
const RUNTIME_CACHE = `minilit-runtime-${VERSION}`;

const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-192-maskable.png',
  './icons/icon-512-maskable.png',
  './icons/apple-touch-icon.png',
];

/* ------------------------------------------------------------------ install */
self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(STATIC_CACHE);
    // Use individual addAll-equivalent so a single 404 doesn't kill the install
    await Promise.all(STATIC_ASSETS.map(async (url) => {
      try {
        const res = await fetch(url, { cache: 'reload' });
        if (res.ok) await cache.put(url, res.clone());
      } catch (_) {
        /* ignore — we'll lazy-cache on first fetch */
      }
    }));
    // Activate immediately
    self.skipWaiting();
  })());
});

/* ----------------------------------------------------------------- activate */
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => {
      if (k !== STATIC_CACHE && k !== RUNTIME_CACHE) return caches.delete(k);
      return null;
    }));
    await self.clients.claim();
  })());
});

/* --------------------------------------------------------------- helpers */
function isSupabase(url) {
  return /\.supabase\.(co|in)$/.test(url.hostname);
}
function isHTMLNavigation(req) {
  return req.mode === 'navigate' ||
    (req.method === 'GET' && (req.headers.get('accept') || '').includes('text/html'));
}
function timeoutFetch(req, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    fetch(req).then((res) => { clearTimeout(t); resolve(res); },
                     (err) => { clearTimeout(t); reject(err); });
  });
}

/* ------------------------------------------------------------------- offline page */
const OFFLINE_HTML = `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Нет подключения — MiniLIT</title>
<style>
  *{box-sizing:border-box}
  html,body{margin:0;padding:0;height:100%}
  body{
    background:radial-gradient(1200px 600px at 50% -10%, #1a1a1a, #0f0f0f 70%, #060606);
    color:#e6e9ee;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
    display:flex;align-items:center;justify-content:center;min-height:100dvh;padding:24px;
  }
  .card{max-width:420px;text-align:center}
  .icon{
    width:96px;height:96px;border-radius:24px;margin:0 auto 22px;
    background:linear-gradient(155deg,#1DBF73,#0e7c4a);
    display:flex;align-items:center;justify-content:center;
    box-shadow:0 0 0 1px rgba(255,255,255,.06), 0 14px 40px rgba(29,191,115,.30);
    position:relative;
  }
  .icon svg{width:54px;height:54px;color:#fff}
  h1{font-size:22px;font-weight:600;margin:0 0 8px}
  p{margin:0 0 22px;color:#9aa3af;font-size:15px;line-height:1.5}
  button{
    appearance:none;border:none;cursor:pointer;
    background:linear-gradient(155deg,#22c55e,#16a34a);color:#fff;
    font-weight:600;font-size:15px;padding:13px 26px;border-radius:12px;
    box-shadow:0 8px 24px rgba(34,197,94,.30);
    transition:transform .12s ease, box-shadow .12s ease;
    min-height:48px;min-width:120px;
  }
  button:hover{transform:translateY(-1px)}
  button:active{transform:translateY(0)}
  small{display:block;margin-top:18px;color:#6b7280;font-size:12px}
</style>
</head>
<body>
  <div class="card">
    <div class="icon" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="1" y1="1" x2="23" y2="23"/>
        <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"/>
        <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"/>
        <path d="M10.71 5.05A16 16 0 0 1 22.58 9"/>
        <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"/>
        <path d="M8.53 16.11a6 6 0 0 1 6.95 0"/>
        <line x1="12" y1="20" x2="12.01" y2="20"/>
      </svg>
    </div>
    <h1>Нет подключения</h1>
    <p>Проверьте интернет и повторите попытку. Часть данных недоступна без сети.</p>
    <button onclick="location.reload()">Повторить</button>
    <small>MiniLIT работает офлайн только для уже посещённых страниц.</small>
  </div>
</body>
</html>`;

/* ---------------------------------------------------------------- fetch */
self.addEventListener('fetch', (event) => {
  const req = event.request;
  // Only handle GET. Browsers do not support caching of POST/PUT/PATCH responses
  // in the standard Cache API and Supabase Realtime uses WS upgrade.
  if (req.method !== 'GET') return;

  let url;
  try { url = new URL(req.url); } catch (_) { return; }

  // Skip Chrome extension URLs, opaque preflight, etc.
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  // 1) Supabase API → network-first with timeout + cache fallback.
  if (isSupabase(url)) {
    event.respondWith((async () => {
      const cache = await caches.open(RUNTIME_CACHE);
      try {
        const fresh = await timeoutFetch(req, 5000);
        if (fresh && fresh.ok && fresh.type !== 'opaque') {
          // Cache successful GETs (selects, storage downloads).
          cache.put(req, fresh.clone()).catch(() => {});
        }
        return fresh;
      } catch (_) {
        const cached = await cache.match(req);
        if (cached) return cached;
        // No cached data and no network — return a JSON-shaped error
        // (Supabase code interprets this gracefully).
        return new Response(
          JSON.stringify({ error: 'offline', message: 'No network connection.' }),
          { status: 503, headers: { 'Content-Type': 'application/json' } }
        );
      }
    })());
    return;
  }

  // 2) Same-origin static → cache-first.
  const sameOrigin = url.origin === self.location.origin;
  if (sameOrigin) {
    event.respondWith((async () => {
      const cache = await caches.open(STATIC_CACHE);
      const cached = await cache.match(req);
      if (cached) {
        // Refresh in the background (stale-while-revalidate).
        fetch(req).then((res) => {
          if (res && res.ok) cache.put(req, res.clone()).catch(() => {});
        }).catch(() => {});
        return cached;
      }
      try {
        const fresh = await fetch(req);
        if (fresh && fresh.ok) cache.put(req, fresh.clone()).catch(() => {});
        return fresh;
      } catch (err) {
        // For navigations, serve the friendly offline page.
        if (isHTMLNavigation(req)) {
          return new Response(OFFLINE_HTML, {
            status: 200,
            headers: { 'Content-Type': 'text/html; charset=utf-8' },
          });
        }
        throw err;
      }
    })());
    return;
  }

  // 3) Cross-origin (CDNs, fonts, etc.) → network-first, cache success.
  event.respondWith((async () => {
    const cache = await caches.open(RUNTIME_CACHE);
    try {
      const fresh = await fetch(req);
      if (fresh && fresh.ok && fresh.type !== 'opaque') {
        cache.put(req, fresh.clone()).catch(() => {});
      }
      return fresh;
    } catch (_) {
      const cached = await cache.match(req);
      if (cached) return cached;
      if (isHTMLNavigation(req)) {
        return new Response(OFFLINE_HTML, {
          status: 200,
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        });
      }
      return Response.error();
    }
  })());
});

/* ------------------------------------------------ messages (skipWaiting trigger) */
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

/* ----------------------------------------------- push (stub for future) */
self.addEventListener('push', (event) => {
  let payload = { title: 'MiniLIT', body: 'Новое уведомление' };
  try {
    if (event.data) payload = Object.assign(payload, event.data.json());
  } catch (_) {
    if (event.data) payload.body = event.data.text();
  }
  const options = {
    body: payload.body,
    icon: './icons/icon-192.png',
    badge: './icons/icon-192.png',
    data: payload.url || './',
    vibrate: [100, 50, 100],
    tag: payload.tag || 'minilit-notice',
    renotify: false,
  };
  event.waitUntil(self.registration.showNotification(payload.title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification && event.notification.data) || './';
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of all) {
      try {
        const u = new URL(client.url);
        if (u.origin === self.location.origin) {
          client.focus();
          if (target && typeof client.navigate === 'function') {
            try { await client.navigate(target); } catch (_) {}
          }
          return;
        }
      } catch (_) {}
    }
    if (self.clients.openWindow) await self.clients.openWindow(target);
  })());
});
