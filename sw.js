/* Service worker: aplikace funguje i bez internetu.
   Online se vždy zkusí načíst nejnovější verze, offline se použije uložená kopie. */
const CACHE = 'padel-v3';
const FILES = ['./', './index.html', './manifest.webmanifest', './icon.svg'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* Otevření stránky (spuštění z plochy, obnovení): vždy dostane aplikaci.
   Když server vrátí chybu (např. 404 na staré adrese padel.html) nebo není signál,
   použije se index.html – online čerstvý, jinak z uložené kopie. Parametry v adrese
   (např. návrat z přihlášení do Dropboxu) zůstávají v adrese, aplikace si je přečte. */
async function openApp(req) {
  try {
    const res = await fetch(req);
    if (res.ok) {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put('./index.html', copy));
      return res;
    }
    const fresh = await fetch('./index.html', { cache: 'no-store' });
    if (fresh.ok) return fresh;
  } catch (e) { /* bez signálu */ }
  const cached = await caches.match('./index.html');
  return cached || fetch('./index.html');
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;                       /* ostatní požadavky (POST, PUT…) se nechají být */
  if (new URL(req.url).origin !== self.location.origin) return;
  if (req.mode === 'navigate') { e.respondWith(openApp(req)); return; }
  e.respondWith(
    fetch(req)
      .then(res => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: true }))
  );
});
