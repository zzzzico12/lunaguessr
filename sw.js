// Service worker: makes LunaGuessr installable and playable offline (except images loaded live from USGS).
//
// Strategy
// - Page, CSS, JS, manifest: network first, so players always get the latest code when online;
//   the cached copy is used offline. All modules come from the same fetch round, so versions never mix.
// - Images in assets/ and version-pinned CDN files: cache first (they do not change at the same URL).
// - USGS imagery: network only (random spots are one-off, caching them would just fill storage).
//
// Bump VERSION to clear the cache, e.g. after regenerating images under the same file names.
const VERSION = "v1";
const CACHE = `lunaguessr-${VERSION}`;

// Precached on install so the game starts offline.
const PRECACHE = [
  "./",
  "index.html",
  "manifest.webmanifest",
  "css/style.css",
  "js/main.js", "js/globe.js", "js/modes.js", "js/geo.js", "js/i18n.js", "js/share.js", "js/questions.js",
  "assets/moon_4k.jpg", "assets/elevation.png", "assets/moon_disk.jpg",
  "assets/icon.svg", "assets/icon-192.png", "assets/apple-touch-icon.png",
  "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js",
  "https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/controls/OrbitControls.js",
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(c => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key.startsWith("lunaguessr-") && key !== CACHE) await caches.delete(key);
    await self.clients.claim();
  })());
});

async function put(request, response) {
  if (response.ok || response.type === "opaque") (await caches.open(CACHE)).put(request, response.clone());
  return response;
}

async function networkFirst(request) {
  try { return await put(request, await fetch(request)); }
  catch {
    return (await caches.match(request, { ignoreSearch: true }))
      ?? (request.mode === "navigate" ? caches.match("index.html") : Response.error());
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try { return await put(request, await fetch(request)); }
  catch { return Response.error(); }
}

const CDN_HOSTS = ["cdn.jsdelivr.net", "fonts.googleapis.com", "fonts.gstatic.com"];

self.addEventListener("fetch", event => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  if (url.hostname === "planetarymaps.usgs.gov") return; // network only

  if (url.origin === self.location.origin) {
    const isImage = /\.(jpe?g|png|svg|webp)$/i.test(url.pathname);
    event.respondWith(isImage ? cacheFirst(request) : networkFirst(request));
  } else if (CDN_HOSTS.includes(url.hostname)) {
    event.respondWith(cacheFirst(request));
  }
});
