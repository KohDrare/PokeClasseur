import { PCX } from "./pokecardex-map.js";
import { VARIANT_ORDER } from "../features/variants.js";
import { API, esc } from "../lib/core.js";
import { LS, idb } from "../lib/storage.js";

/* ---------- network ---------- */
export async function getJSON(url, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try { const r = await fetch(url); if (r.status === 404) return null; if (!r.ok) throw new Error(r.status); return await r.json(); }
    catch (e) { if (i === tries - 1) throw e; await new Promise(r => setTimeout(r, 400 * (i + 1))); }
  }
}
export async function pool(items, n, fn) {
  let i = 0; const out = new Array(items.length);
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k], k); } }));
  return out;
}
window.cardImgErr = el => {
  const tries = +(el.dataset.t || 0); el.dataset.t = tries + 1;
  if (tries === 0) { const u = el.src; setTimeout(() => { el.src = u.includes("/high.webp") ? u.replace("/high.webp", "/low.webp") : u + "?r=1"; }, 400); return; }
  if (tries === 1 && el.src.includes("/high.webp")) { el.src = el.src.replace("/high.webp", "/low.webp"); return; }
  el.replaceWith(Object.assign(document.createElement("div"), { className: "fallback", textContent: el.alt }));
};
/* set logos & code badges: Pokécardex artwork first, then TCGdex (fr, then en) */
export const PCX_CDN = "https://pokecardex.b-cdn.net/assets/images/";
export function logoSrcs(id, tlogo, serie) {
  const out = [];
  if (PCX[id]) out.push(PCX_CDN + "logos/" + PCX[id] + ".png");
  if (tlogo) out.push(tlogo + ".png", tlogo.replace("/fr/", "/en/") + ".png");
  else if (serie) out.push(`https://assets.tcgdex.net/en/${serie}/${id}/logo.png`);
  return out;
}
export function logoImg(id, tlogo, name, serie, silent) {
  const srcs = logoSrcs(id, tlogo, serie);
  if (!srcs.length) return silent ? "" : `<div class="txt">${esc(name)}</div>`;
  return `<img src="${srcs[0]}" data-alt="${esc(srcs.slice(1).join("|"))}" alt="${esc(name)}" loading="lazy" onerror="logoNext(this,${silent ? 1 : 0})">`;
}
window.logoNext = (el, silent) => {
  const rest = (el.dataset.alt || "").split("|").filter(Boolean);
  if (rest.length) { el.dataset.alt = rest.slice(1).join("|"); el.src = rest[0]; return; }
  if (silent) el.remove(); else el.replaceWith(Object.assign(document.createElement("div"), { className: "txt", textContent: el.alt }));
};
export function codeBadge(id, fallback) {
  const c = PCX[id];
  if (c) return `<img class="codeimg" src="${PCX_CDN}symboles/${c}.png" alt="${esc(c)}" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'code',textContent:this.alt}))">`;
  return fallback ? `<span class="code">${esc(fallback)}</span>` : "";
}
window.logoErr = (el, silent) => {
  if (el.src.includes("/fr/")) { el.src = el.src.replace("/fr/", "/en/"); return; }
  if (silent) el.remove(); else el.replaceWith(Object.assign(document.createElement("div"), { className: "txt", textContent: el.alt }));
};
export const img = (base, q = "low") => base ? `${base}/${q}.webp` : "";

/* series index (cached 12h) */
export const HIDDEN_SERIES = new Set(["tcgp"]);
export async function loadSeries(force) {
  const cached = LS.get("pc-series", null);
  if (cached && !force && Date.now() - cached.at < 12 * 3600e3) return cached.data;
  const list = await getJSON(`${API}/series`);
  const full = await pool(list.filter(s => !HIDDEN_SERIES.has(s.id)), 8, s => getJSON(`${API}/series/${encodeURIComponent(s.id)}`).catch(() => null));
  const data = full.filter(Boolean).map(s => ({ id: s.id, name: s.name, logo: s.logo, sets: (s.sets || []).map(t => ({ id: t.id, serie: s.id, name: t.name, logo: t.logo, symbol: t.symbol, total: t.cardCount?.total || 0, official: t.cardCount?.official || 0 })) })).reverse();
  data.forEach(s => s.sets.reverse());
  LS.set("pc-series", { at: Date.now(), data });
  return data;
}

/* one set + every card's details (cached in IndexedDB, refreshed after 5 days for prices) */
export function compact(d, setId) {
  const vs = d.variants || {};
  const p = d.pricing?.cardmarket || {};
  return {
    id: d.id, setId, n: d.localId, name: d.name, img: d.image || "", r: d.rarity || "", cat: d.category || "",
    v: VARIANT_ORDER.filter(k => vs[k]), p: p.trend || p.avg || 0, ph: p["trend-holo"] || p["avg-holo"] || 0,
    dx: d.dexId || [], il: d.illustrator || "", hp: d.hp || "", t: (d.types || []).join(", "), st: d.stage || "", rm: d.regulationMark || "", ok: 1
  };
}
export async function loadSet(setId, onProgress) {
  const key = "set2:" + setId;
  const cached = await idb.get(key);
  const fresh = cached && Date.now() - cached.at < 5 * 864e5 && cached.cards.every(c => c.ok);
  if (fresh) return cached;
  const s = await getJSON(`${API}/sets/${encodeURIComponent(setId)}`);
  if (!s) throw new Error("Extension introuvable");
  const info = { id: s.id, name: s.name, logo: s.logo, symbol: s.symbol, date: s.releaseDate, abbr: s.abbreviation?.official || "", serie: s.serie, total: s.cardCount?.total || s.cards.length, official: s.cardCount?.official || 0 };
  const prev = new Map((cached?.cards || []).map(c => [c.id, c]));
  const cards = s.cards.map(c => prev.get(c.id) && prev.get(c.id).ok ? { ...prev.get(c.id), img: c.image || "" } : { id: c.id, setId, n: c.localId, name: c.name, img: c.image || "", r: "", v: [], ok: 0 });
  const res = { at: Date.now(), info, cards };
  onProgress?.(res, 0);
  let done = 0;
  await pool(cards, 10, async (c, k) => {
    try { const d = await getJSON(`${API}/cards/${encodeURIComponent(c.id)}`); if (d) cards[k] = compact(d, setId); } catch {}
    done++; if (done % 6 === 0 || done === cards.length) onProgress?.(res, done / cards.length);
  });
  await idb.set(key, res);
  return res;
}
export async function peekSet(setId) { return idb.get("set2:" + setId); }
