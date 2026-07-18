// Service worker : "réseau d'abord, cache en secours".
// - En ligne : on sert toujours la dernière version (pas de contenu périmé
//   pendant que tu développes), et on met à jour le cache au passage.
// - Hors-ligne : on sert la dernière version mise en cache → l'appli, une fois
//   installée et lancée au moins une fois, fonctionne sans réseau.
const CACHE = 'lauren-lois-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  event.respondWith(
    fetch(req)
      .then((resp) => {
        if (resp && resp.ok) {
          const copy = resp.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copy)).catch(() => {});
        }
        return resp;
      })
      .catch(() => caches.match(req))
  );
});
