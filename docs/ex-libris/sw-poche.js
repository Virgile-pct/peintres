/*
 * Garde la version téléphone en mémoire : elle s'ouvre même sans réseau, au fond d'une librairie.
 * Stratégie : on répond tout de suite avec la copie gardée, et on la rafraîchit en arrière-plan
 * (une mise à jour de l'appli apparaît donc à l'ouverture suivante).
 * Seuls les fichiers de la version téléphone sont concernés ; le reste passe sans détour.
 */
const CACHE = 'ex-libris-poche-4';
const FICHIERS = [
  'poche.html', 'manifest-poche.webmanifest', 'css/app.css', 'css/poche.css',
  'js/outils.js', 'js/icones.js', 'js/isbn.js', 'js/catalogues.js', 'js/couverture.js', 'js/scanner.js', 'js/poche.js',
  'icones/poche-192.png',
];
const ADRESSES = new Set(FICHIERS.map((f) => new URL(f, self.registration.scope).href));

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FICHIERS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((cles) => Promise.all(cles.filter((k) => k.startsWith('ex-libris-poche') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const polices = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (!ADRESSES.has(url.origin + url.pathname) && !polices) return;

  const reseau = caches.open(CACHE).then((cache) =>
    fetch(req).then((reponse) => {
      if (reponse.ok || reponse.type === 'opaque') cache.put(req, reponse.clone());
      return reponse;
    })
  );
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then((enMemoire) => enMemoire || reseau)
  );
  e.waitUntil(reseau.catch(() => {}));
});
