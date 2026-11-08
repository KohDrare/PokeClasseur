import { PCX } from "./pokecardex-map.js";
import { priceCheck, priceHint } from "./price-hints.js";
import { CARD_FIX, EXTRA, HIDDEN_SETS, LINKED, MERGED, PATCH_V, UPCOMING, dexFromName, extraCount, isScan, scanBase, upcomingVariants } from "./set-patches.js";
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
  if (isScan(el.src)) {   // Pokécardex scans: their server is sometimes slow, try once more
    if (tries === 0) { const u = el.src; setTimeout(() => { el.src = u + "&r=1"; }, 800); return; }
    el.replaceWith(Object.assign(document.createElement("div"), { className: "fallback", textContent: el.alt })); return;
  }
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
export const img = (base, q = "low") => !base ? "" : isScan(base) ? `${base}.jpg?class=${q === "high" ? "hd" : "md"}` : `${base}/${q}.webp`;

/* series index (cached 12h) */
export const HIDDEN_SERIES = new Set(["tcgp"]);
export async function loadSeries(force) {
  const cached = LS.get("pc-series", null);
  if (cached && !force && Date.now() - cached.at < 12 * 3600e3) return patchSeries(cached.data);
  const list = await getJSON(`${API}/series`);
  const full = await pool(list.filter(s => !HIDDEN_SERIES.has(s.id)), 8, s => getJSON(`${API}/series/${encodeURIComponent(s.id)}`).catch(() => null));
  const data = full.filter(Boolean).map(s => ({ id: s.id, name: s.name, logo: s.logo, sets: (s.sets || []).map(t => ({ id: t.id, serie: s.id, name: t.name, logo: t.logo, symbol: t.symbol, total: t.cardCount?.total || 0, official: t.cardCount?.official || 0 })) })).reverse();
  data.forEach(s => s.sets.reverse());
  LS.set("pc-series", { at: Date.now(), data });
  return patchSeries(data);
}
/* merged sets disappear from the list (their cards are counted in the main set), extra promos are counted */
/* logos shipped with the app (public/logos), for sets TCGdex does not have yet */
const localLogo = path => path ? (import.meta.env?.BASE_URL || "/") + path : "";
export function patchSeries(data) {
  const all = new Map(data.flatMap(s => s.sets).map(t => [t.id, t]));
  // announced sets TCGdex does not have yet
  data = data.map(s => {
    const add = Object.entries(UPCOMING).filter(([id, u]) => u.info.serie.id === s.id && !all.has(id))
      .map(([id, u]) => ({ id, serie: s.id, name: u.info.name, logo: localLogo(u.info.logo), total: u.info.total, official: u.info.official }));
    return add.length ? { ...s, sets: [...add, ...s.sets] } : s;
  });
  return data.map(s => ({ ...s, sets: s.sets.filter(t => !HIDDEN_SETS.has(t.id)).map(t => {
    const m = MERGED[t.id], add = (m ? all.get(m.from)?.total || 0 : 0) + extraCount(t.id);
    return add ? { ...t, total: t.total + add } : t;
  }) }));
}

/* one set + every card's details (cached in IndexedDB, refreshed after 5 days for prices) */
export function compact(d, setId) {
  const vs = d.variants || {};
  const p = d.pricing?.cardmarket || {};
  const bad = priceCheck(setId, d.localId, p.trend || p.avg || 0, d.pricing?.tcgplayer);
  return {
    id: d.id, setId, n: d.localId, name: d.name, img: d.image || "", r: d.rarity || "", cat: d.category || "",
    v: VARIANT_ORDER.filter(k => vs[k]), p: bad ? bad.p : p.trend || p.avg || 0, ph: bad ? 0 : p["trend-holo"] || p["avg-holo"] || 0,
    dx: d.dexId || [], il: d.illustrator || "", hp: d.hp || "", t: (d.types || []).join(", "), st: d.stage || "", rm: d.regulationMark || "", ok: 1
  };
}
const PATCHED = id => MERGED[id] || EXTRA[id] || LINKED[id] || UPCOMING[id];
// cards with a known Pokécardex scan always use it (TCGdex may list a picture that does not exist yet)
const fixCard = c => { if (!c.p && priceHint(c.setId, c.n)) c = { ...c, p: priceHint(c.setId, c.n), hint: 1 }; const f = CARD_FIX[c.id]; return f ? { ...c, n: f.n, src: f.src, img: f.scan ? scanBase(c.setId, f.src, f.scan) : c.img } : c; };
export const setKey = setId => "set2:" + setId + (PATCHED(setId) ? ":p" + PATCH_V : "");
const withScan = c => { c = fixCard(c); return c.img || !c.n ? c : { ...c, img: scanBase(c.scanSet || c.setId, c.src || c.n, c.extra?.scan || c.scan) }; };
export async function loadSet(setId, onProgress) {
  const key = setKey(setId);
  const cached = await idb.get(key);
  const fresh = cached && Date.now() - cached.at < 5 * 864e5 && cached.cards.every(c => c.ok);
  if (fresh) return cached;
  const s = await getJSON(`${API}/sets/${encodeURIComponent(setId)}`).catch(e => { if (UPCOMING[setId]) return null; throw e; });
  if (!s && UPCOMING[setId]) return upcomingSet(setId, key);
  if (!s) throw new Error("Extension introuvable");
  const info = { id: s.id, name: s.name, logo: s.logo, symbol: s.symbol, date: s.releaseDate, abbr: s.abbreviation?.official || "", serie: s.serie, total: s.cardCount?.total || s.cards.length, official: s.cardCount?.official || 0 };
  const prev = new Map((cached?.cards || []).map(c => [c.id, c]));
  const stub = (c, extra) => prev.get(c.id)?.ok ? fixCard({ ...prev.get(c.id), img: c.image || prev.get(c.id).img || "" }) : withScan({ id: c.id, setId, n: c.localId, name: c.name, img: c.image || "", r: "", v: [], ok: 0, ...extra });
  const cards = s.cards.map(c => stub(c));
  // cards TCGdex does not have yet
  for (const x of EXTRA[setId] || []) {
    const id = `${setId}-${x.id || x.n}`;
    if (cards.some(c => c.id === id)) continue;
    cards.push(stub({ id, localId: x.n, name: x.name }, { extra: x, scan: x.scan }));
    info.total = Math.max(info.total, cards.length);
  }
  // numbered cards in order; cards like R/RGB after them, in their own order
  const num = n => { const m = /^\D*(\d+)$/.exec(n); return m ? +m[1] : Infinity; };
  const ord = c => CARD_FIX[c.id]?.order ?? 99;
  if (EXTRA[setId]) cards.sort((a, b) => (num(a.n) - num(b.n)) || (ord(a) - ord(b)));
  // a set shown inside this one (30ᵉ Anniversaire + Collection Classique)
  const m = MERGED[setId];
  if (m) {
    const sub = await getJSON(`${API}/sets/${encodeURIComponent(m.from)}`).catch(() => null);
    for (const c of sub?.cards || []) cards.push(stub({ ...c }, { scanSet: m.from, n: m.prefix + String(+c.localId || c.localId).padStart(2, "0"), grp: m.label, src: c.localId }));
    if (sub) { info.special = sub.cards.length; info.specialLabel = m.label; info.total += sub.cards.length; }
  }
  // promos sold with this set's products (ETB, blisters…): the card stays in its promo set, shown here too
  if (LINKED[setId]) {
    const promo = await loadSet("mep").catch(() => null);
    const byId = new Map((promo?.cards || []).map(c => [c.id, c]));
    let n = 0;
    for (const [num, prod] of LINKED[setId]) { const c = byId.get(`mep-${num}`); if (c) { cards.push({ ...c, linked: 1, prod, grp: "Promos" }); n++; } }
    if (n) { info.promos = n; info.promoSet = promo.info.name; }
  }
  const res = { at: Date.now(), info, cards };
  onProgress?.(res, 0);
  let done = 0;
  await pool(cards, 10, async (c, k) => {
    if (c.linked) { done++; return; }   // already loaded with its promo set
    try {
      if (c.extra) {   // not on TCGdex in French: English details when they exist, French name and scan
        const d = c.extra.en ? await getJSON(`${API.replace("/fr", "/en")}/cards/${encodeURIComponent(c.id)}`).catch(() => null) : null;
        const base = d ? compact(d, setId) : { id: c.id, setId, n: c.n, name: c.name, img: "", r: c.extra.r || "Promo", cat: c.extra.cat || "Pokémon", v: ["holo"], p: 0, ph: 0, dx: c.extra.dx || [], ok: 1 };
        cards[k] = withScan({ ...base, id: c.id, n: c.n, name: c.extra.name, img: "", scan: c.extra.scan, cat: c.extra.cat || base.cat, dx: base.dx?.length || c.extra.cat ? base.dx : dexFromName(c.extra.name), ok: 1 });
      } else {
        const d = await getJSON(`${API}/cards/${encodeURIComponent(c.id)}`);
        if (d) {
          const full = compact(d, setId);
          if (c.grp) Object.assign(full, { n: c.n, grp: c.grp, scanSet: c.scanSet, src: c.src, r: full.r === "Sans Rareté" ? c.grp : full.r });
          if (!full.dx.length && full.cat !== "Dresseur" && full.cat !== "Énergie") full.dx = dexFromName(full.name);
          cards[k] = withScan(full);
        }
      }
    } catch {}
    done++; if (done % 6 === 0 || done === cards.length) onProgress?.(res, done / cards.length);
  });
  await idb.set(key, res);
  return res;
}
/* an announced set built from the cards revealed so far (checked again online every day) */
async function upcomingSet(setId, key) {
  const u = UPCOMING[setId];
  const cards = u.cards.map(c => withScan({ hint: 1, id: `${setId}-${c.n}`, setId, n: c.n, name: c.name, img: "", r: c.r, cat: c.cat, v: upcomingVariants(c), p: priceHint(setId, c.n), ph: 0,
    dx: c.cat === "Pokémon" ? dexFromName(c.name) : [], ok: 1 }));
  const info = { ...u.info, logo: localLogo(u.info.logo), symbol: "", upcoming: cards.length };
  const promo = LINKED[setId] ? await loadSet("mep").catch(() => null) : null;
  let n = 0;
  for (const [num, prod] of LINKED[setId] || []) { const c = promo?.cards.find(x => x.id === `mep-${num}`); if (c) { cards.push({ ...c, linked: 1, prod, grp: "Promos" }); n++; } }
  if (n) { info.promos = n; info.promoSet = promo.info.name; }
  const res = { at: Date.now() - 4 * 864e5, info, cards };
  await idb.set(key, res);
  return res;
}
export async function peekSet(setId) { return idb.get(setKey(setId)); }
