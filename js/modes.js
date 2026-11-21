// Game modes: each one builds the list of rounds for a game.
import { QUESTIONS } from "./questions.js";
import { rng, hashStr, shuffle, randomPoint, wmsCrop } from "./geo.js";

export const ROUNDS = 5;
const WIDE_FACTOR = 3.2;
const LAUNCH_DAY = Date.UTC(2026, 10, 21); // Daily #1

const fromQuestion = q => ({
  kind: "feature", id: q.id, lat: q.lat, lon: q.lon, km: q.km,
  img: `assets/questions/${q.id}.jpg`, wide: `assets/questions/${q.id}_wide.jpg`,
  wideKm: Math.min(q.km * WIDE_FACTOR, 2400),
  name: q.name, desc: q.desc, feature: q.feature,
});

export function randomRound(rand = Math.random) {
  const p = randomPoint(rand);
  const km = Math.round(180 + rand() * 240);
  const wideKm = km * WIDE_FACTOR;
  return { kind: "random", lat: p.lat, lon: p.lon, km, wideKm, img: wmsCrop(p.lat, p.lon, km), wide: wmsCrop(p.lat, p.lon, wideKm) };
}

const pick = (set, n, rand) => shuffle(QUESTIONS.filter(q => q.sets.includes(set)), rand).slice(0, n);

/** UTC date key, e.g. "2026-11-22". The daily puzzle changes at 00:00 UTC. */
export function todayKey(now = new Date()) { return now.toISOString().slice(0, 10); }
export function dailyNumber(now = new Date()) {
  const d = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.floor((d - LAUNCH_DAY) / 864e5) + 1;
}

export const MODES = {
  daily: {
    online: true,
    build() {
      const rand = rng(hashStr("lunaguessr-" + todayKey()));
      const near = pick("near", 2, rand), far = pick("far", 1, rand);
      const used = new Set([...near, ...far].map(q => q.id));
      const landing = shuffle(QUESTIONS.filter(q => q.sets.includes("landing") && !used.has(q.id)), rand).slice(0, 1);
      const rounds = [...near, ...far, ...landing].map(fromQuestion);
      rounds.push(randomRound(rand));
      return shuffle(rounds, rand);
    },
  },
  near: { build: () => pick("near", ROUNDS).map(fromQuestion) },
  far: { build: () => pick("far", ROUNDS).map(fromQuestion) },
  landing: { build: () => pick("landing", ROUNDS).map(fromQuestion) },
  anywhere: { online: true, build: () => Array.from({ length: ROUNDS }, () => randomRound(Math.random)) },
};
export const MODE_ORDER = ["daily", "near", "far", "landing", "anywhere"];

/** Named places for the "nearest named feature" line after a random round. */
export const MARIA = [
  { name: { en: "Mare Imbrium", ja: "雨の海" }, lat: 32.8, lon: -15.6, km: 1146 },
  { name: { en: "Mare Serenitatis", ja: "晴れの海" }, lat: 28, lon: 17.5, km: 674 },
  { name: { en: "Mare Tranquillitatis", ja: "静かの海" }, lat: 8.5, lon: 31.4, km: 873 },
  { name: { en: "Mare Crisium", ja: "危難の海" }, lat: 17, lon: 59.1, km: 556 },
  { name: { en: "Mare Fecunditatis", ja: "豊かの海" }, lat: -7.8, lon: 51.3, km: 909 },
  { name: { en: "Mare Nectaris", ja: "神酒の海" }, lat: -15.2, lon: 35.5, km: 333 },
  { name: { en: "Mare Nubium", ja: "雲の海" }, lat: -21.3, lon: -16.6, km: 715 },
  { name: { en: "Mare Humorum", ja: "湿りの海" }, lat: -24.4, lon: -38.6, km: 389 },
  { name: { en: "Oceanus Procellarum", ja: "嵐の大洋" }, lat: 18.4, lon: -57.4, km: 2568 },
  { name: { en: "Mare Frigoris", ja: "氷の海" }, lat: 56, lon: 1.4, km: 1596 },
  { name: { en: "Mare Vaporum", ja: "蒸気の海" }, lat: 13.3, lon: 3.6, km: 245 },
  { name: { en: "Mare Cognitum", ja: "知られた海" }, lat: -10, lon: -23.1, km: 376 },
];
export const NAMED_PLACES = [
  ...MARIA,
  ...QUESTIONS.filter(q => !q.sets.includes("landing") || q.sets.length > 1).map(q => ({ name: q.name, ...q.feature })),
];
