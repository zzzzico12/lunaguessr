// Game flow and UI.
import { Globe } from "./globe.js";
import { t, L, nf, lang, setLang, applyStatic } from "./i18n.js";
import { distKm, fmtLL, fmtKm, scoreFor, MAX_SCORE } from "./geo.js";
import { MODES, MODE_ORDER, ROUNDS, MARIA, NAMED_PLACES, randomRound, todayKey, dailyNumber } from "./modes.js";

const $ = id => document.getElementById(id);
const ROUND_SECONDS = 60;
const store = {
  get(k) { try { return JSON.parse(localStorage.getItem("lunaguessr:" + k)); } catch { return null; } },
  set(k, v) { try { localStorage.setItem("lunaguessr:" + k, JSON.stringify(v)); } catch {} },
};

const state = {
  phase: "menu", mode: null, rounds: [], round: 0, total: 0, log: [],
  guess: null, hint: false, wide: false, timerOn: !!store.get("timer"), deadline: 0, showMares: false,
};

// ---------- globe ----------
const globe = new Globe($("globePanel"), {
  onPick(p) {
    if (state.phase !== "guess") return;
    state.guess = p; globe.setGuess(p); renderDock();
  },
  onHover(p) { $("readout").innerHTML = p ? `${t("cursor")} <b>${fmtLL(p)}</b>` : t("hover"); },
  onDetail(loading) { $("detailNote").hidden = !loading; },
});
const mareLabels = () => MARIA.map(m => ({ text: L(m.name), lat: m.lat, lon: m.lon }));
$("labelBtn").onclick = () => {
  state.showMares = !state.showMares;
  $("labelBtn").setAttribute("aria-pressed", state.showMares);
  globe.setMareLabels(mareLabels(), state.showMares);
};
$("resetBtn").onclick = () => globe.reset();

// ---------- menu ----------
function renderMenu() {
  $("modeList").innerHTML = MODE_ORDER.map(id => {
    const daily = id === "daily" ? store.get("daily:" + todayKey()) : null;
    const badge = id === "daily"
      ? `<span class="badge">${t("dailyNumber", { n: dailyNumber() })}</span>`
      : "";
    return `<button class="mode mode-${id}" data-mode="${id}">
      <span class="mode-title">${t("mode." + id)} ${badge}</span>
      <span class="mode-desc">${t("mode." + id + ".desc")}</span>
      ${daily ? `<span class="mode-meta played">${t("dailyPlayed", { score: nf(daily.total) })}</span>` : ""}
      ${MODES[id].online && id === "anywhere" ? `<span class="mode-meta">${t("needsNet")}</span>` : ""}
    </button>`;
  }).join("");
  $("modeList").querySelectorAll("[data-mode]").forEach(b => (b.onclick = () => startGame(b.dataset.mode)));
  $("timerToggle").checked = state.timerOn;
}
$("timerToggle").onchange = e => { state.timerOn = e.target.checked; store.set("timer", state.timerOn); };
$("menuBtn").onclick = showMenu;

function showMenu() {
  stopTimer();
  state.phase = "menu";
  $("final").hidden = true;
  renderMenu();
  $("menu").hidden = false;
  $("modeList").querySelector("button")?.focus();
}

// ---------- game ----------
function startGame(mode) {
  if (mode === "daily") {
    const done = store.get("daily:" + todayKey());
    if (done) { Object.assign(state, { mode, total: done.total, log: done.log, phase: "final" }); $("menu").hidden = true; renderFinal(); return; }
  }
  Object.assign(state, { mode, rounds: MODES[mode].build(), round: 0, total: 0, log: [] });
  $("menu").hidden = true; $("final").hidden = true;
  globe.reset();
  startRound();
}

function startRound() {
  Object.assign(state, { guess: null, hint: false, wide: false, phase: "guess" });
  globe.clearResult();
  stopTimer();
  renderHud(); renderHint(); renderDock(); loadPhoto();
  const next = state.rounds[state.round + 1];
  if (next) [next.img, next.wide].forEach(src => (new Image().src = src));
}

function renderHud() {
  $("hudRound").textContent = `${Math.min(state.round + 1, ROUNDS)} / ${ROUNDS}`;
  $("hudScore").textContent = nf(state.total);
  $("hudMode").textContent = state.mode ? t("mode." + state.mode) : "–";
  $("hudTimerWrap").hidden = !state.timerOn || state.phase === "menu";
}

// ---------- photo ----------
const photo = $("photo");
function loadPhoto() {
  const r = state.rounds[state.round];
  $("photoStatus").hidden = false;
  $("photoStatus").innerHTML = `<span>${t("loading")}</span>`;
  photo.classList.add("loading");
  photo.src = state.wide ? r.wide : r.img;
  renderPhotoMeta();
}
photo.addEventListener("load", () => {
  photo.classList.remove("loading");
  $("photoStatus").hidden = true;
  renderPhotoMeta();
  if (state.phase === "guess" && state.timerOn && !state.deadline) startTimer();
});
photo.addEventListener("error", () => {
  if (state.phase === "menu") return;
  $("photoStatus").innerHTML = `<span>${t("loadFailed")}</span>
    <span class="row"><button class="ghost" id="retryBtn">${t("retry")}</button><button class="ghost" id="skipBtn">${t("skip")}</button></span>`;
  $("retryBtn").onclick = loadPhoto;
  $("skipBtn").onclick = () => { state.rounds[state.round] = randomRound(); startRound(); };
});

function renderPhotoMeta() {
  const r = state.rounds[state.round]; if (!r) return;
  const km = state.wide ? r.wideKm : r.km;
  $("photoMeta").textContent = t("photoMeta", { km: nf(Math.round(km)) });
  const target = km * 0.22;
  const nice = [10, 20, 25, 50, 100, 200, 250, 500, 1000].reduce((a, b) => (Math.abs(b - target) < Math.abs(a - target) ? b : a));
  $("sbar").style.width = `${(nice / km) * (photo.clientWidth || 300)}px`;
  $("sbarLabel").textContent = `${nice} km`;
}
new ResizeObserver(renderPhotoMeta).observe(photo);

function renderHint() {
  $("hintBtn").setAttribute("aria-pressed", state.wide);
  $("hintBtn").textContent = t("wideView");
  $("hintNote").textContent = state.hint ? t("wideUsed") : t("findCenter");
}
$("hintBtn").onclick = () => {
  state.wide = !state.wide;
  if (state.wide && state.phase === "guess") state.hint = true;
  renderHint(); loadPhoto();
};

// ---------- timer ----------
let timerId = 0;
function startTimer() {
  state.deadline = Date.now() + ROUND_SECONDS * 1000;
  tick(); timerId = setInterval(tick, 250);
}
function stopTimer() { clearInterval(timerId); state.deadline = 0; $("hudTimer").classList.remove("low"); }
function tick() {
  const left = Math.max(0, Math.ceil((state.deadline - Date.now()) / 1000));
  $("hudTimer").textContent = `${left}s`;
  $("hudTimer").classList.toggle("low", left <= 10);
  if (left === 0) { stopTimer(); submit(); }
}

// ---------- guess and result ----------
function renderDock() {
  const dock = $("dock");
  if (state.phase === "guess") {
    dock.innerHTML = `<button class="primary" id="guessBtn" ${state.guess ? "" : "disabled"}>
      ${state.guess ? t("guessHere", { ll: fmtLL(state.guess) }) : t("placeGuess")}</button>`;
    $("guessBtn").onclick = submit;
  } else if (state.phase === "result") {
    const e = state.log[state.log.length - 1], r = e.round, last = state.round + 1 >= ROUNDS;
    const name = r.name ? L(r.name) : t("randomSpot");
    let body = e.guess ? `${t("offBy", { d: `<b>${fmtKm(e.d)}</b>` })}${e.hint ? t("wideNote") : ""}.` : t("timesUp");
    if (r.desc) body += ` ${L(r.desc)}`;
    else if (e.nearest) body += ` ${t("nearest", { name: L(e.nearest.name), d: fmtKm(e.nearest.d) })}`;
    dock.innerHTML = `<div class="result" role="status">
      <h2>${name}</h2>
      <div class="pts">${nf(e.pts)}<small>/ ${nf(MAX_SCORE)} ${t("pts")}</small></div>
      <div class="meter"><i style="width:${(e.pts / MAX_SCORE) * 100}%"></i></div>
      <p>${body}</p>
      <span class="legend"><span class="g">●</span> ${t("yourGuess")} · <span class="t">●</span> ${t("answer")} ${fmtLL(r)}</span>
      <button class="primary" id="nextBtn">${last ? t("results") : t("next")}</button></div>`;
    $("nextBtn").onclick = next;
  } else dock.innerHTML = "";
}

function submit() {
  if (state.phase !== "guess") return;
  if (!state.guess && !state.timerOn) return;
  stopTimer();
  const r = state.rounds[state.round];
  const d = state.guess ? distKm(state.guess, r) : null;
  const pts = state.guess ? scoreFor(d, r.km, state.hint) : 0;
  const entry = { round: r, guess: state.guess, d, pts, hint: state.hint };
  if (r.kind === "random") {
    const near = NAMED_PLACES.map(p => ({ name: p.name, d: Math.max(0, distKm(p, r) - p.km / 2) })).sort((a, b) => a.d - b.d)[0];
    entry.nearest = near;
  }
  state.log.push(entry); state.total += pts; state.phase = "result";
  globe.showResult(state.guess, { lat: r.lat, lon: r.lon }, r.feature, r.name ? L(r.name) : "");
  renderHud(); renderDock();
  $("nextBtn").focus();
}

function next() {
  if (state.round + 1 >= ROUNDS) return finish();
  state.round++; startRound();
}

function finish() {
  state.phase = "final";
  if (state.mode === "daily") {
    store.set("daily:" + todayKey(), {
      total: state.total,
      log: state.log.map(e => ({ pts: e.pts, d: e.d, hint: e.hint, round: { name: e.round.name ?? null } })),
    });
  }
  renderFinal();
}

const rankFor = total => t("rank." + (total >= 22000 ? 4 : total >= 16000 ? 3 : total >= 9000 ? 2 : 1));
const squares = log => log.map(e => (e.pts >= 4000 ? "🟩" : e.pts >= 2500 ? "🟨" : e.pts >= 1000 ? "🟧" : "🟥")).join("");
function shareText() {
  const title = state.mode === "daily"
    ? `LunaGuessr ${t("mode.daily")} #${dailyNumber()} 🌕`
    : `LunaGuessr · ${t("mode." + state.mode)} 🌕`;
  return `${title}\n${nf(state.total)} / ${nf(MAX_SCORE * ROUNDS)}\n${squares(state.log)}\n${location.origin}${location.pathname}`;
}

function renderFinal() {
  stopTimer();
  $("finalTotal").innerHTML = `${nf(state.total)} <small>/ ${nf(MAX_SCORE * ROUNDS)}</small>`;
  $("finalMode").textContent = t("mode." + state.mode) + (state.mode === "daily" ? ` #${dailyNumber()}` : "");
  $("finalRank").innerHTML = `${t("rank")}: <span class="rank">${rankFor(state.total)}</span>`;
  $("finalTable").innerHTML = state.log.map((e, i) => `<tr>
    <td>${i + 1}. ${e.round.name ? L(e.round.name) : t("randomSpot")}${e.hint ? ` <span class="note">(${t("wideTag")})</span>` : ""}</td>
    <td class="n">${e.d == null ? "–" : fmtKm(e.d)}</td><td class="s">${nf(e.pts)}</td></tr>`).join("");
  $("shareText").textContent = shareText();
  $("againBtn").hidden = state.mode === "daily";
  $("final").hidden = false;
  $("shareBtn").focus();
}
$("shareBtn").onclick = async () => {
  try { await navigator.clipboard.writeText(shareText()); $("shareNote").textContent = t("copied"); }
  catch {
    const range = document.createRange(); range.selectNodeContents($("shareText"));
    getSelection().removeAllRanges(); getSelection().addRange(range);
    $("shareNote").textContent = t("copyFailed");
  }
};
$("againBtn").onclick = () => startGame(state.mode);
$("finalMenuBtn").onclick = showMenu;

document.addEventListener("keydown", e => {
  if (e.key !== "Enter" || e.target.closest("button, input")) return;
  if (state.phase === "guess" && state.guess) submit();
  else if (state.phase === "result") next();
});

// ---------- language ----------
function renderLang() {
  applyStatic();
  $("langBtn").textContent = lang === "ja" ? "English" : "日本語";
  $("readout").textContent = t("hover");
  renderHud();
  if (state.phase === "menu") renderMenu();
  if (state.phase === "guess" || state.phase === "result") { renderHint(); renderPhotoMeta(); renderDock(); }
  if (state.phase === "final") renderFinal();
  if (state.showMares) globe.setMareLabels(mareLabels(), true);
}
$("langBtn").onclick = () => { setLang(lang === "ja" ? "en" : "ja"); renderLang(); };

setLang(lang);
renderLang();
showMenu();
