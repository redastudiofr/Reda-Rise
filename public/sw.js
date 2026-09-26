/* Service worker: offline cache + web push. */

const VERSION = 'v3';
const STATIC_CACHE = `reda-static-${VERSION}`;
const PAGE_CACHE = `reda-pages-${VERSION}`;

// Only assets that never redirect are precached; pages are cached as they are
// visited, so the login redirect never ends up stored as the app shell.
const PRECACHE = [
  '/offline',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/maskable-512.png',
  '/icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(STATIC_CACHE);
      await Promise.allSettled(PRECACHE.map((url) => cache.add(url)));
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => !k.endsWith(VERSION)).map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  // App data is always fresh from the network; the client keeps its own copy.
  if (url.pathname.startsWith('/api/')) return;

  if (req.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(req);
          if (fresh.ok && !fresh.redirected) {
            const cache = await caches.open(PAGE_CACHE);
            cache.put(req, fresh.clone());
          }
          return fresh;
        } catch (err) {
          const cached = await caches.match(req, { ignoreSearch: true });
          if (cached) return cached;
          const offline = await caches.match('/offline');
          if (offline) return offline;
          throw err;
        }
      })(),
    );
    return;
  }

  const isImmutable =
    url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/');

  event.respondWith(
    (async () => {
      const cache = await caches.open(STATIC_CACHE);
      const cached = await cache.match(req);
      if (cached && isImmutable) return cached;

      const network = fetch(req)
        .then((res) => {
          if (res.ok) cache.put(req, res.clone());
          return res;
        })
        .catch(() => null);

      if (cached) {
        // Stale-while-revalidate for everything that can change.
        network.catch(() => null);
        return cached;
      }
      const res = await network;
      if (res) return res;
      throw new Error('offline');
    })(),
  );
});

/* ---------- push ---------- */

self.addEventListener('push', (event) => {
  let payload = { title: 'Telos RS', body: '' };
  if (event.data) {
    try {
      payload = event.data.json();
    } catch (_) {
      payload = { title: 'Telos RS', body: event.data.text() };
    }
  }

  event.waitUntil(
    self.registration.showNotification(payload.title || 'Telos RS', {
      body: payload.body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: payload.tag || 'reda',
      renotify: true,
      data: { url: payload.url || '/' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });
      for (const client of clientList) {
        if ('focus' in client) {
          await client.focus();
          if ('navigate' in client) {
            try {
              await client.navigate(target);
            } catch (_) {
              /* already on a page we cannot navigate */
            }
          }
          return;
        }
      }
      await self.clients.openWindow(target);
    })(),
  );
});

// Chrome may rotate the subscription; ask the page to re-register next time.
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({ type: 'window' });
      for (const client of clientList) client.postMessage({ type: 'resubscribe' });
    })(),
  );
});
