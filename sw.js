const CACHE_NOM = 'kaali-v1';
const FICHIERS_A_CACHER = [
  '/',
  '/index.html',
  '/style.css',
  '/app.js',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NOM).then((cache) => cache.addAll(FICHIERS_A_CACHER))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((noms) =>
      Promise.all(noms.filter(n => n !== CACHE_NOM).map(n => caches.delete(n)))
    )
  );
});

self.addEventListener('fetch', (event) => {
  // Ne jamais mettre en cache les appels vers Supabase (données toujours fraîches si en ligne)
  if (event.request.url.includes('supabase.co')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((reponseCache) => {
      return reponseCache || fetch(event.request).then((reponseReseau) => {
        return caches.open(CACHE_NOM).then((cache) => {
          cache.put(event.request, reponseReseau.clone());
          return reponseReseau;
        });
      }).catch(() => caches.match('/index.html'));
    })
  );
});
