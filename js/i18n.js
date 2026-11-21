// UI strings in English and Japanese. Question names and descriptions live in questions.js.

const STRINGS = {
  en: {
    tagline: "Find where on the Moon a real orbital photo was taken.",
    round: "ROUND", score: "SCORE", mode: "MODE", time: "TIME",
    chooseMode: "Choose a mission",
    timer: "60-second timer", timerNote: "Each round ends after 60 seconds.",
    start: "Start",
    "mode.daily": "Daily Challenge", "mode.daily.desc": "Five new spots every day, the same for everyone. Share your score.",
    "mode.near": "Near Side Classics", "mode.near.desc": "Famous craters, seas and valleys you can see from Earth.",
    "mode.far": "Far Side", "mode.far.desc": "The hemisphere that never faces Earth. Hard.",
    "mode.landing": "Landing Sites", "mode.landing.desc": "Apollo, Luna, Chang'e, Chandrayaan, SLIM and more.",
    "mode.anywhere": "Anywhere", "mode.anywhere.desc": "Random spots across the whole Moon. Endless and very hard.",
    needsNet: "Loads images live from USGS",
    dailyPlayed: "Played today: {score}",
    dailyNumber: "#{n}",
    photoLabel: "LRO WAC orbital image",
    photoMeta: "{km} km wide · north up",
    wideView: "Wide view (score ×0.6)", wideUsed: "Wide view used (score ×0.6)",
    findCenter: "Find the center of the photo",
    loading: "Loading image…",
    loadFailed: "Could not load the image from USGS.", retry: "Retry", skip: "Skip this spot",
    hover: "Drag to rotate · scroll or pinch to zoom · click to place your guess",
    cursor: "Cursor",
    detail: "Sharpening view…",
    mareNames: "Mare names", resetView: "Reset view", menu: "Menu",
    placeGuess: "Click the Moon to place a guess",
    guessHere: "Guess here ({ll})",
    pts: "pts",
    offBy: "Off by {d}",
    timesUp: "Time's up. No guess was placed.",
    wideNote: " (wide view ×0.6)",
    nearest: "Nearest named feature: {name}, {d} away.",
    yourGuess: "Your guess", answer: "Answer",
    next: "Next round", results: "See results",
    report: "MISSION REPORT",
    rank: "Rank",
    "rank.4": "Lunar Surveyor", "rank.3": "Orbiting Astronaut", "rank.2": "Amateur Lunar Observer", "rank.1": "Earthbound Stargazer",
    playAgain: "Play again", backToMenu: "Back to menu",
    share: "Copy result", copied: "Copied", copyFailed: "Select the text above and copy it.",
    wideTag: "wide view",
    randomSpot: "Unnamed spot",
    credit: "Imagery: NASA / GSFC / Arizona State University (LRO WAC global mosaic), served by USGS Astrogeology. Elevation: NASA LOLA via NASA SVS. LunaGuessr is a fan project and is not affiliated with or endorsed by NASA.",
    keys: "Enter: guess / next",
  },
  ja: {
    tagline: "本物の軌道写真が月のどこで撮られたかを当てるゲーム。",
    round: "ラウンド", score: "スコア", mode: "モード", time: "残り",
    chooseMode: "ミッションを選ぶ",
    timer: "60秒タイマー", timerNote: "各ラウンドを60秒で打ち切ります。",
    start: "スタート",
    "mode.daily": "デイリーチャレンジ", "mode.daily.desc": "毎日5問、全員同じ問題。結果をシェアできます。",
    "mode.near": "表側の名所", "mode.near.desc": "地球から見える有名なクレーター・海・谷。",
    "mode.far": "月の裏側", "mode.far.desc": "地球から決して見えない半球。難しい。",
    "mode.landing": "着陸地点", "mode.landing.desc": "アポロ、ルナ、嫦娥、チャンドラヤーン、SLIMなど。",
    "mode.anywhere": "どこでも", "mode.anywhere.desc": "月全体のランダムな地点。無限に遊べる最難関。",
    needsNet: "USGSから画像をその場で読み込みます",
    dailyPlayed: "今日のスコア：{score}",
    dailyNumber: "#{n}",
    photoLabel: "LRO WAC 軌道写真",
    photoMeta: "幅 {km} km ・ 北が上",
    wideView: "広域で見る（得点 ×0.6）", wideUsed: "広域ヒント使用済み（得点 ×0.6）",
    findCenter: "写真の中心が正解地点です",
    loading: "画像を読み込み中…",
    loadFailed: "USGSから画像を読み込めませんでした。", retry: "再試行", skip: "この地点を飛ばす",
    hover: "ドラッグで回転・ホイールかピンチで拡大・クリックで地点を指定",
    cursor: "カーソル",
    detail: "高解像度で表示中…",
    mareNames: "海の名前", resetView: "正面に戻す", menu: "メニュー",
    placeGuess: "月をクリックして地点を指定",
    guessHere: "ここに決定（{ll}）",
    pts: "点",
    offBy: "誤差 {d}",
    timesUp: "時間切れ。地点が指定されませんでした。",
    wideNote: "（広域ヒント ×0.6）",
    nearest: "最寄りの地名：{name}（{d}）",
    yourGuess: "あなた", answer: "正解",
    next: "次のラウンドへ", results: "結果を見る",
    report: "ミッション報告",
    rank: "称号",
    "rank.4": "月面測量士", "rank.3": "月周回飛行士", "rank.2": "アマチュア月面観測家", "rank.1": "地上からの見物客",
    playAgain: "もう一度", backToMenu: "メニューに戻る",
    share: "結果をコピー", copied: "コピーしました", copyFailed: "上のテキストを選択してコピーしてください。",
    wideTag: "広域",
    randomSpot: "名前のない地点",
    credit: "画像：NASA / GSFC / アリゾナ州立大学（LRO WAC 全球モザイク、USGS Astrogeology 配信）。標高：NASA LOLA（NASA SVS 経由）。LunaGuessr はファンによる非公式プロジェクトで、NASA とは関係がなく、NASA の承認も受けていません。",
    keys: "Enter：決定／次へ",
  },
};

const STORE_KEY = "lunaguessr:lang";

function detect() {
  try { const saved = localStorage.getItem(STORE_KEY); if (saved in STRINGS) return saved; } catch {}
  return (navigator.language || "en").toLowerCase().startsWith("ja") ? "ja" : "en";
}

export let lang = detect();

export function setLang(next) {
  lang = next;
  try { localStorage.setItem(STORE_KEY, next); } catch {}
  document.documentElement.lang = next;
}

export function t(key, vars = {}) {
  const s = STRINGS[lang][key] ?? STRINGS.en[key] ?? key;
  return s.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");
}

/** Pick the current language from a {en, ja} object. */
export const L = obj => (obj && typeof obj === "object" ? obj[lang] ?? obj.en : obj);

export const nf = n => n.toLocaleString(lang === "ja" ? "ja-JP" : "en-US");

/** Fill every [data-i18n] element with its string. */
export function applyStatic(root = document) {
  root.querySelectorAll("[data-i18n]").forEach(el => { el.textContent = t(el.dataset.i18n); });
}
