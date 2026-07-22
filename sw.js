// On change ce numéro de version à chaque mise à jour importante pour forcer le rafraîchissement
const CACHE_NOM = 'kaali-v2';
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
  self.skipWaiting(); // Force la nouvelle version à prendre le contrôle immédiatement
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((noms) =>
      Promise.all(noms.filter(n => n !== CACHE_NOM).map(n => caches.delete(n)))
    ).then(() => self.clients.claim()) // Prend le contrôle de tous les onglets ouverts
  );
});

self.addEventListener('fetch', (event) => {
  // Ne jamais mettre en cache les appels vers Supabase (données toujours fraîches)
  if (event.request.url.includes('supabase.co')) {
    return;
  }

  // STRATEGIE "RESEAU D'ABORD" : on essaie toujours d'avoir la dernière version en ligne.
  // Le cache ne sert que si le réseau est indisponible (vrai mode hors-ligne).
  event.respondWith(
    fetch(event.request)
      .then((reponseReseau) => {
        return caches.open(CACHE_NOM).then((cache) => {
          cache.put(event.request, reponseReseau.clone());
          return reponseReseau;
        });
      })
      .catch(() => caches.match(event.request).then(r => r || caches.match('/index.html')))
  );
});
