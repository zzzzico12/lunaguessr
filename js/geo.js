// Lunar geometry, scoring and image URLs. No DOM or Three.js here.

export const R_KM = 1737.4;
export const KM_PER_DEG = (R_KM * Math.PI) / 180;
const RAD = Math.PI / 180;

/** Great-circle distance in km. */
export function distKm(a, b) {
  const dLat = (b.lat - a.lat) * RAD, dLon = (b.lon - a.lon) * RAD;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * RAD) * Math.cos(b.lat * RAD) * Math.sin(dLon / 2) ** 2;
  return 2 * R_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

export const wrapLon = lon => ((((lon + 180) % 360) + 360) % 360) - 180;

export const fmtLL = p =>
  `${Math.abs(p.lat).toFixed(1)}°${p.lat >= 0 ? "N" : "S"} ${Math.abs(p.lon).toFixed(1)}°${p.lon >= 0 ? "E" : "W"}`;

export const fmtKm = d => (d < 10 ? `${d.toFixed(1)} km` : `${Math.round(d).toLocaleString("en-US")} km`);

/**
 * Score for one round, out of MAX_SCORE.
 * The tolerance grows with the photo width, so a wide photo of a big basin is not
 * easier to max out than a tight photo of a small crater.
 */
export const MAX_SCORE = 5000;
export const HINT_MULT = 0.6;
export function scoreFor(dKm, photoKm, usedHint) {
  const tolerance = 0.8 * photoKm + 150;
  const base = dKm <= photoKm * 0.04 ? MAX_SCORE : MAX_SCORE * Math.exp(-dKm / tolerance);
  return Math.round(base * (usedHint ? HINT_MULT : 1));
}

/** LRO WAC mosaic crop from the USGS WMS, centered on lat/lon, `km` wide, north up. */
const WMS =
  "https://planetarymaps.usgs.gov/cgi-bin/mapserv?map=/maps/earth/moon_simp_cyl.map" +
  "&SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&LAYERS=LROC_WAC&STYLES=&SRS=EPSG:4326&FORMAT=image/jpeg";
export function wmsBBox(minLon, minLat, maxLon, maxLat, w, h) {
  // The layer spans -180..360, so shift crops west of -180 into the 180..360 range.
  if (minLon < -180) { minLon += 360; maxLon += 360; }
  return `${WMS}&BBOX=${minLon},${minLat},${maxLon},${maxLat}&WIDTH=${w}&HEIGHT=${h}`;
}
export function wmsCrop(lat, lon, km, px = 720) {
  const dLat = km / KM_PER_DEG / 2;
  const dLon = dLat / Math.cos(lat * RAD);
  return wmsBBox(lon - dLon, lat - dLat, lon + dLon, lat + dLat, px, px);
}

/** Seeded PRNG (mulberry32) so the daily challenge is the same for every player. */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const hashStr = s => [...s].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0, 2166136261);

export function shuffle(arr, rand = Math.random) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

/** Uniformly random point on the sphere, limited to |lat| <= maxLat (the mosaic is poor near the poles). */
export function randomPoint(rand, maxLat = 70) {
  const s = Math.sin(maxLat * RAD);
  const lat = Math.asin((rand() * 2 - 1) * s) / RAD;
  const lon = rand() * 360 - 180;
  return { lat, lon };
}
