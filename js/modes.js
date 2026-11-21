// Game modes: each one builds the list of rounds for a game.
import { QUESTIONS } from "./questions.js";
import { rng, hashStr, shuffle, randomPoint, wmsCrop } from "./geo.js";

export const ROUNDS = 5;
const WIDE_FACTOR = 3.2;

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

/**
 * Date key in the player's own time zone, e.g. "2026-11-21".
 * Like Wordle, the puzzle changes at local midnight, and everyone on the same calendar date gets the same five spots.
 */
export function todayKey(now = new Date()) {
  const p = n => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

export const MODES = {
  daily: {
    online: true,
    build(key = todayKey()) {
      const rand = rng(hashStr("lunaguessr-" + key));
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
// Modes shown on the menu. near / far / landing still feed the daily challenge and can be added back here.
export const MODE_ORDER = ["daily", "anywhere"];

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
