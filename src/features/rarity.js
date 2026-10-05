import { esc } from "../lib/core.js";

/* ---------- rarity ---------- */
/* Rarity marks drawn as SVG, shaped like the symbols printed on the cards (and used by Pokécardex). */
export const RAR = [
  [/^commune$/, "circle", 1],
  [/^peu commune$/, "diamond", 2],
  [/^rare$/, "star-o", 3],
  [/^(holo rare|rare holo)$/, "star", 4],
  [/(radieux|high-tech|v$|vmax|vstar|lv\.x|prime|légende|break|gx|ex$|holo rare)/, "star", 4.5],
  [/^double rare$/, "star2", 5],
  [/^ace spec/, "sparkle-pink", 5.5],
  [/^illustration rare$/, "star-gold", 6],
  [/^(ultra rare|rare ultra)$/, "star2-silver", 7],
  [/chromatique.*ultra|shiny ultra/, "star2-teal", 7.5],
  [/chromatique|shiny/, "star-teal", 7.4],
  [/^(illustration spéciale rare|magnifique rare|rare arc-en-ciel|full art)/, "star2-gold", 8],
  [/^(hyper rare|rare secrète|secret rare|rare gold)/, "star3-gold", 9],
  [/méga hyper rare/, "sparkle-gold", 10]
];
export function rarity(label) {
  if (!label || /^aucune$/i.test(label)) return { sym: "none", cls: "", rank: 0, label: label || "Sans rareté" };
  const l = label.toLowerCase();
  for (const [re, sym, rank] of RAR) if (re.test(l)) return { sym, cls: "", rank, label };
  return { sym: "diamond-o", cls: "", rank: 3.5, label };
}
export function starPts(cx, cy, R) {
  const r = R * 0.42, pts = [];
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, d = i % 2 ? r : R; pts.push((cx + d * Math.cos(a)).toFixed(2) + "," + (cy + d * Math.sin(a)).toFixed(2)); }
  return pts.join(" ");
}
export const RCOL = { gold: "#f2b01e", silver: "#a3a9b5", teal: "#25b3b0", pink: "#e0569b" };
export const SVG_CACHE = {};
export function symSVG(kind) {
  if (SVG_CACHE[kind]) return SVG_CACHE[kind];
  const [shape, tone] = kind.split("-");
  const col = RCOL[tone] || "currentColor";
  let body = "";
  if (shape === "circle") body = `<circle cx="11" cy="11" r="7" fill="${col}"/>`;
  else if (shape === "diamond") body = tone === "o" ? `<path d="M11 3.5 17.5 11 11 18.5 4.5 11z" fill="none" stroke="currentColor" stroke-width="1.6"/>` : `<path d="M11 3 18 11 11 19 4 11z" fill="${col}"/>`;
  else if (shape === "star" && tone === "o") body = `<polygon points="${starPts(11, 11.8, 9)}" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>`;
  else if (shape === "star") body = `<polygon points="${starPts(11, 11.8, 9.2)}" fill="${col}"/>`;
  else if (shape === "star2") body = `<polygon points="${starPts(6.6, 8.6, 5.4)}" fill="${col}"/><polygon points="${starPts(15.6, 13.6, 5.4)}" fill="${col}"/>`;
  else if (shape === "star3") body = `<polygon points="${starPts(4.6, 8.4, 4.4)}" fill="${col}"/><polygon points="${starPts(11, 14.2, 4.4)}" fill="${col}"/><polygon points="${starPts(17.4, 8.4, 4.4)}" fill="${col}"/>`;
  else if (shape === "sparkle") body = `<path d="M11 1.5C11.9 7.6 14.4 10.1 20.5 11 14.4 11.9 11.9 14.4 11 20.5 10.1 14.4 7.6 11.9 1.5 11 7.6 10.1 10.1 7.6 11 1.5z" fill="${col}" stroke="#3a2a06" stroke-width="1.1" stroke-linejoin="round"/>`;
  else body = `<circle cx="11" cy="11" r="2.4" fill="currentColor" opacity=".5"/>`;
  return SVG_CACHE[kind] = `<svg class="rsvg" viewBox="0 0 22 22" aria-hidden="true">${body}</svg>`;
}
export const symHTML = (label, title = true) => { const r = rarity(label); return `<span class="sym"${title ? ` title="${esc(r.label)}"` : ""}>${symSVG(r.sym)}</span>`; };
