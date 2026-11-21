// The share image: total, rank and each round's score, drawn over the full Moon.
import { MAX_SCORE } from "./geo.js";

const loadImage = src => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });

/**
 * Draw a 1200x630 result card with the full Moon behind it.
 * `info` = { title, total, max, rank, roundsHeading, rounds: [{pts, label, score}], url }
 */
export async function drawShareCard(info) {
  const W = 1200, H = 630;
  const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
  const g = cv.getContext("2d");
  await Promise.all([
    document.fonts.load('600 40px "Chakra Petch"'), document.fonts.load('500 20px "IBM Plex Mono"'),
  ]).catch(() => {});
  const [moon, icon] = await Promise.all([loadImage("assets/moon_disk.jpg"), loadImage("assets/apple-touch-icon.png")]);

  g.fillStyle = "#07090d"; g.fillRect(0, 0, W, H);
  g.drawImage(moon, 600, -110, 850, 850);
  const fade = g.createLinearGradient(0, 0, W, 0);
  fade.addColorStop(0.38, "rgba(7,9,13,1)"); fade.addColorStop(0.75, "rgba(7,9,13,0.35)"); fade.addColorStop(1, "rgba(7,9,13,0.1)");
  g.fillStyle = fade; g.fillRect(0, 0, W, H);

  const display = '"Chakra Petch", system-ui, sans-serif', mono = '"IBM Plex Mono", ui-monospace, monospace';
  g.drawImage(icon, 64, 52, 48, 48);
  g.font = `600 40px ${display}`; g.textBaseline = "middle";
  g.fillStyle = "#c9ccd3"; g.fillText("Luna", 124, 78);
  g.fillStyle = "#8fb8e6"; g.fillText("Guessr", 124 + g.measureText("Luna").width, 78);

  g.textBaseline = "alphabetic";
  g.fillStyle = "#8fb8e6"; g.font = `600 30px ${display}`; g.fillText(info.title, 64, 178);
  g.fillStyle = "#e6e8ec"; g.font = `600 120px ${display}`; g.fillText(info.total, 60, 300);
  const tw = g.measureText(info.total).width;
  g.fillStyle = "#7d8596"; g.font = `500 34px ${display}`; g.fillText(`/ ${info.max}`, 72 + tw, 300);
  g.fillStyle = "#c9ccd3"; g.font = `500 26px ${display}`; g.fillText(info.rank, 64, 346);

  // Per-round scores: a labelled column for each round, with a bar showing the share of 5,000.
  g.fillStyle = "#7d8596"; g.font = `500 16px ${mono}`; g.fillText(info.roundsHeading.toUpperCase(), 64, 412);
  const colW = 128, gap = 16, top = 430;
  info.rounds.forEach((r, i) => {
    const x = 64 + i * (colW + gap);
    g.fillStyle = "#161b24"; g.fillRect(x, top, colW, 96);
    g.fillStyle = "#7d8596"; g.font = `500 15px ${mono}`; g.fillText(r.label, x + 12, top + 26);
    g.fillStyle = "#8fb8e6"; g.font = `600 34px ${display}`; g.fillText(r.score, x + 12, top + 66);
    g.fillStyle = "#232a36"; g.fillRect(x + 12, top + 80, colW - 24, 5);
    g.fillStyle = "#8fb8e6"; g.fillRect(x + 12, top + 80, (colW - 24) * Math.max(0, Math.min(1, r.pts / MAX_SCORE)), 5);
  });

  g.fillStyle = "#7d8596"; g.font = `500 18px ${mono}`; g.fillText(info.url, 64, H - 40);
  return new Promise(res => cv.toBlob(res, "image/png"));
}
