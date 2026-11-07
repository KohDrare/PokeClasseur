import { openCard } from "../components/card-modal.js";
import { loadSet, logoImg, peekSet } from "../data/tcgdex.js";
import { rarity, symHTML } from "../features/rarity.js";
import { eur, foilOf, fxHTML, priceOf } from "../features/variants.js";
import { $, ICON, esc } from "../lib/core.js";
import { LS } from "../lib/storage.js";
import { imgTag, numLabel, setNav } from "../lib/ui.js";
import { dexCounts } from "./pokedex.js";
import { isFav, ownedAny, ownedBySet } from "../state/collection.js";
import { S } from "../state/shared.js";
import { UN } from "../union/store.js";

/* ================= COLLECTION =================
   Top: the value of the collection with its curve (one point per day, kept on this device),
   a preview of the most valuable cards, then every card, sorted the way you choose. */

const SORTS = [
  { k: "num", l: "Par numéro de carte", d: 1, i: '<rect x="4" y="3" width="13" height="17" rx="2"/><path d="M19 13v8M15.5 15.5h7M15.5 18.5h7"/>' },
  { k: "type", l: "Par type", d: 1, i: '<circle cx="12" cy="12" r="9"/><path d="m12 6 1.6 4.4L18 12l-4.4 1.6L12 18l-1.6-4.4L6 12l4.4-1.6z"/>' },
  { k: "rar", l: "Par rareté", d: -1, i: '<path d="M12 3 21 12 12 21 3 12z"/>' },
  { k: "qty", l: "Par nombre d'exemplaires", d: -1, i: '<rect x="4" y="3" width="13" height="17" rx="2"/><path d="M20 6v14a1 1 0 0 1-1 1H8"/>' },
  { k: "set", l: "Par extension", d: -1, i: '<rect x="5" y="2.5" width="14" height="19" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M5 12h4M15 12h4"/>' },
  { k: "price", l: "Par prix", d: -1, i: '<path d="M17 6.5A6.5 6.5 0 1 0 17 17.5"/><path d="M4 10h9M4 14h9"/>' },
  { k: "fav", l: "Par favoris", d: -1, i: '<path d="M6 3h12v18l-6-4-6 4z"/><path d="m12 7 1.1 2.3 2.5.3-1.8 1.8.4 2.5-2.2-1.2-2.2 1.2.4-2.5-1.8-1.8 2.5-.3z"/>' }
];
const TYPES = ["Plante", "Feu", "Eau", "Électrique", "Psy", "Combat", "Obscurité", "Métal", "Dragon", "Fée", "Incolore"];
const svg = (p, w = 2) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
const ARROW_UP = svg('<path d="M12 19V5M6 11l6-6 6 6"/>', 2.2);
const SORT_ICON = svg('<path d="M7 4v16M3.5 16.5 7 20l3.5-3.5M14 6h7M14 12h5M14 18h3"/>');

let pref = LS.get("pc-colsort", { k: "set", d: -1, range: "30" });
let query = "";

/* ---- value history: one point per day + the previous day's detail (to split "new cards" from "price moves") ---- */
const HKEY = "pc-valhist";
const today = () => new Date().toLocaleDateString("sv-SE");   // YYYY-MM-DD, local
function recordValue(v, q) {
  const h = LS.get(HKEY, { days: [], ref: null, cur: null });
  const d = today();
  if (h.cur && h.cur.d !== d) h.ref = h.cur;                 // yesterday's last state becomes the reference
  h.cur = { d, v, q };
  const last = h.days[h.days.length - 1];
  if (last?.d === d) last.v = v; else h.days.push({ d, v });
  if (h.days.length > 800) h.days = h.days.slice(-800);
  LS.set(HKEY, h);
  return h;
}

export async function renderCollection() {
  setNav("col"); S.CUR = null;
  const app = $("#app");
  const by = ownedBySet();
  const ids = Object.keys(by);
  app.innerHTML = `<section class="band colband"><div class="wrap">
      <h1>Ma collection</h1>
      <div class="colhero" id="colhero"><div class="valcard"><div class="note">Calcul de la valeur…</div></div></div>
    </div></section>
    <div class="wrap" id="colall">
      <div class="toolbar coltools">
        <label class="search" for="q-col">${ICON.search}<input id="q-col" placeholder="Rechercher dans ma collection" value="${esc(query)}" autocomplete="off"></label>
        <button class="toggle" id="col-sort">${SORT_ICON}<span id="col-sortl"></span></button>
      </div>
      <div id="colbody"></div>
    </div>`;
  if (!ids.length) {
    $("#colhero").innerHTML = `<div class="valcard"><div class="vc-lbl">Collection totale</div><div class="vc-val">0 €</div></div>`;
    $("#colbody").innerHTML = `<div class="empty-state"><b>Ta collection est vide pour l'instant</b>Va dans <a href="#/">Séries</a>, ouvre une extension et coche tes cartes.</div>`;
    return;
  }
  $("#colbody").innerHTML = `<div class="empty-state"><b>Préparation de ta vitrine…</b></div>`;
  const sets = [];
  for (const id of ids) { let s = await peekSet(id); if (!s) { try { s = await loadSet(id); } catch { continue; } } sets.push(s); }
  if (!location.hash.startsWith("#/collection")) return;

  // every owned card, with what we sort on
  const items = [];
  for (const s of sets) for (const c of s.cards) {
    if (!ownedAny(c.id)) continue;
    const e = S.COL.cards[c.id], vs = Object.entries(e.v).filter(([, n]) => n > 0);
    items.push({
      c: Object.assign(c, { _info: s.info }), info: s.info,
      q: vs.reduce((a, [, n]) => a + n, 0),
      val: vs.reduce((a, [v, n]) => a + priceOf(c, v) * n, 0),
      unit: Math.max(0, ...vs.map(([v]) => priceOf(c, v))),
      no: parseInt((c.src || c.n || "").replace(/\D+/g, "")) || 0,
      date: s.info.date || ""
    });
  }
  drawHero(items);
  drawSortLabel();
  $("#q-col").oninput = e => { query = e.target.value; drawBody(items); };
  $("#col-sort").onclick = () => openSort(items);
  drawBody(items);
}

/* ---------- value card + preview ---------- */
function drawHero(items) {
  const value = items.reduce((a, x) => a + x.val, 0);
  const q = {};
  for (const x of items) for (const [v, n] of Object.entries(S.COL.cards[x.c.id].v)) if (n > 0) q[x.c.id + "|" + v] = n;
  const h = recordValue(Math.round(value * 100) / 100, q);
  // change since the reference day: new / removed cards at today's prices, the rest is the market
  let dCol = null, dMkt = null;
  if (h.ref) {
    const price = new Map(items.flatMap(x => Object.keys(S.COL.cards[x.c.id].v).map(v => [x.c.id + "|" + v, priceOf(x.c, v)])));
    dCol = 0;
    const keys = new Set([...Object.keys(q), ...Object.keys(h.ref.q || {})]);
    for (const k of keys) dCol += ((q[k] || 0) - (h.ref.q?.[k] || 0)) * (price.get(k) || 0);
    dMkt = value - h.ref.v - dCol;
  }
  const since = h.ref ? (h.ref.d === new Date(Date.now() - 864e5).toLocaleDateString("sv-SE") ? "24 h" : "depuis le " + new Date(h.ref.d).toLocaleDateString("fr-BE", { day: "numeric", month: "short" })) : "";
  const sign = n => (n > 0.004 ? "+" : n < -0.004 ? "−" : "") + eur(Math.abs(n)).replace("–", "0 €");
  const top = [...items].sort((a, b) => b.unit - a.unit).slice(0, 6);
  const copies = items.reduce((a, x) => a + x.q, 0), dupes = items.filter(x => x.q > 1).length;

  $("#colhero").innerHTML = `
    <div class="valcard">
      <div class="vc-top">
        <div><div class="vc-lbl">Collection totale</div>
          <a class="vc-dex" href="#/pokedex">${svg('<path d="M12 6c-2-1.5-5-2-9-2v15c4 0 7 .5 9 2 2-1.5 5-2 9-2V4c-4 0-7 .5-9 2z"/><path d="M12 6v15"/>')}Pokédex ${dexCounts().size}/1025</a></div>
        ${h.ref ? `<div class="vc-delta"><span class="${dMkt < -0.004 ? "dn" : dMkt > 0.004 ? "up" : ""}">Marché ${sign(dMkt)} (${since})</span><span class="${dCol < -0.004 ? "dn" : dCol > 0.004 ? "up" : ""}">Collection ${sign(dCol)} (${since})</span></div>` : ""}
      </div>
      <div class="vc-val">${eur(value).replace("–", "0 €")}</div>
      <div class="vc-chart" id="vc-chart"></div>
      <div class="vc-foot">
        <div class="seg vc-range" id="vc-range">${[["7", "7 j"], ["30", "1 mois"], ["365", "1 an"], ["all", "Tout"]].map(([k, l]) => `<button data-r="${k}" class="${pref.range === k ? "on" : ""}">${l}</button>`).join("")}</div>
        <span class="note">Prix tendance Cardmarket</span>
      </div>
    </div>
    <div class="colpeek">
      <div class="cp-hd2"><h2>Aperçu de mes cartes</h2><button class="linkbtn" id="peek-all">Voir tout</button></div>
      <div class="peekgrid">${top.map((x, i) => `<button class="peek" data-peek="${i}" aria-label="${esc(x.c.name)}">${imgTag(x.c, "low")}${fxHTML(foilOf(x.c))}${x.unit ? `<span class="pchip">${eur(x.unit)}</span>` : ""}</button>`).join("")}</div>
      <div class="peekstats">
        <span><b>${items.length}</b> carte${items.length > 1 ? "s" : ""}</span>
        <span><b>${copies}</b> exemplaire${copies > 1 ? "s" : ""}</span>
        <span><b>${dupes}</b> doublon${dupes > 1 ? "s" : ""}</span>
        <a href="#/union"><b>${UN.wish.length}</b> souhait${UN.wish.length > 1 ? "s" : ""}</a>
      </div>
    </div>`;
  drawChart(h.days, value);
  $("#vc-range").onclick = e => { const b = e.target.closest("button"); if (!b) return; pref.range = b.dataset.r; LS.set("pc-colsort", pref); [...e.currentTarget.children].forEach(x => x.classList.toggle("on", x === b)); drawChart(h.days, value); };
  $("#peek-all").onclick = () => $("#colall").scrollIntoView({ behavior: "smooth", block: "start" });
  $("#colhero .peekgrid").onclick = e => { const b = e.target.closest("[data-peek]"); if (!b) return; const seq = top.map(x => x.c); openCardIn(seq[+b.dataset.peek], seq); };
}

/* the curve: daily values, filled area, green going up / red going down */
function drawChart(days, now) {
  const el = $("#vc-chart"); if (!el) return;
  const cut = pref.range === "all" ? "" : new Date(Date.now() - (+pref.range) * 864e5).toLocaleDateString("sv-SE");
  const pts = days.filter(p => p.d >= cut).map(p => ({ t: Date.parse(p.d), v: p.v }));
  if (!pts.length || pts[pts.length - 1].v !== now) pts.push({ t: Date.now(), v: now });
  const W = 600, H = 150, P = 6;
  if (pts.length < 2) {
    el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"><path d="M0 ${H * 0.62}H${W}" class="ln flat"/></svg><p class="vc-empty">La courbe se remplit jour après jour : chaque jour où tu ouvres ta collection, sa valeur est notée.</p>`;
    return;
  }
  const t0 = pts[0].t, t1 = pts[pts.length - 1].t || t0 + 1;
  let lo = Math.min(...pts.map(p => p.v)), hi = Math.max(...pts.map(p => p.v));
  if (hi - lo < 1) { hi += 1; lo = Math.max(0, lo - 1); }
  const X = t => (t - t0) / Math.max(1, t1 - t0) * W, Y = v => H - P - (v - lo) / (hi - lo) * (H - 2 * P);
  const d = pts.map((p, i) => `${i ? "L" : "M"}${X(p.t).toFixed(1)} ${Y(p.v).toFixed(1)}`).join("");
  const up = pts[pts.length - 1].v >= pts[0].v;
  el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" class="${up ? "up" : "dn"}" aria-label="Évolution de la valeur">
    <defs><linearGradient id="vcg" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="currentColor" stop-opacity=".35"/><stop offset="1" stop-color="currentColor" stop-opacity="0"/></linearGradient></defs>
    <path d="${d}L${W} ${H}L0 ${H}Z" fill="url(#vcg)"/><path d="${d}" class="ln"/></svg>`;
}

/* ---------- sort sheet ---------- */
function drawSortLabel() {
  const s = SORTS.find(x => x.k === pref.k) || SORTS[4];
  $("#col-sortl").innerHTML = `${esc(s.l.replace("Par ", "").replace(/^./, m => m.toUpperCase()))} <i class="sdir ${pref.d > 0 ? "" : "down"}">${ARROW_UP}</i>`;
}
function openSort(items) {
  const root = $("#modal-root");
  const close = () => { root.innerHTML = ""; document.body.style.overflow = ""; removeEventListener("keydown", key); };
  const key = e => { if (e.key === "Escape") close(); };
  addEventListener("keydown", key); document.body.style.overflow = "hidden";
  const draw = () => {
    root.innerHTML = `<div class="modal" id="mdl"><div class="sheet sortsheet" role="dialog" aria-modal="true" aria-label="Trier">
      <h2>Trier</h2>
      <div class="sortlist">${SORTS.map(s => `<button class="sortopt ${pref.k === s.k ? "on" : ""}" data-k="${s.k}"><span>${s.l}</span>${svg(s.i)}${pref.k === s.k ? `<i class="sdir ${pref.d > 0 ? "" : "down"}" title="${pref.d > 0 ? "Croissant" : "Décroissant"}">${ARROW_UP}</i>` : ""}</button>`).join("")}</div>
      <p class="note">Touche encore le tri choisi pour inverser l'ordre.</p>
      <button class="cp-close sortclose" id="m-close" aria-label="Fermer">${ICON.x}</button>
    </div></div>`;
    $("#m-close").onclick = close;
    $("#mdl").onclick = e => { if (e.target.id === "mdl") close(); };
    root.querySelector(".sortlist").onclick = e => {
      const b = e.target.closest("[data-k]"); if (!b) return;
      const s = SORTS.find(x => x.k === b.dataset.k);
      if (pref.k === s.k) pref.d = -pref.d; else { pref.k = s.k; pref.d = s.d; }
      LS.set("pc-colsort", pref);
      drawSortLabel(); drawBody(items); draw();
    };
  };
  draw();
}

/* ---------- the cards ---------- */
const typeRank = c => { const t = (c.t || "").split(",")[0].trim(); const i = TYPES.indexOf(t); return i >= 0 ? i : c.cat === "Dresseur" ? 20 : c.cat === "Énergie" ? 21 : 19; };
function sorted(items) {
  const d = pref.d, bySetNo = (a, b) => a.date.localeCompare(b.date) || a.info.id.localeCompare(b.info.id) || a.no - b.no || (a.c.n || "").localeCompare(b.c.n || "");
  const key = {
    num: (a, b) => d * bySetNo(a, b),
    set: (a, b) => d * (a.date.localeCompare(b.date) || a.info.id.localeCompare(b.info.id)) || a.no - b.no,
    type: (a, b) => d * (typeRank(a.c) - typeRank(b.c)) || a.c.name.localeCompare(b.c.name, "fr"),
    rar: (a, b) => d * (rarity(a.c.r).rank - rarity(b.c.r).rank) || b.unit - a.unit,
    qty: (a, b) => d * (a.q - b.q) || b.unit - a.unit,
    price: (a, b) => d * (a.unit - b.unit) || bySetNo(a, b),
    fav: (a, b) => d * (isFav(a.c.id) - isFav(b.c.id)) || b.unit - a.unit
  }[pref.k] || ((a, b) => bySetNo(a, b));
  return [...items].sort(key);
}
const tile = (x, i) => `<div class="tile owned">
    <button class="cardimg" data-i="${i}" aria-label="${esc(x.c.name)}">${imgTag(x.c, "low")}${fxHTML(foilOf(x.c))}${isFav(x.c.id) ? `<span class="favtag" aria-label="Favorite">★</span>` : ""}</button>
    ${x.q > 1 ? `<span class="qty">×${x.q}</span>` : ""}
    <div class="cap"><span class="n">${esc(numLabel(x.c, x.info))}</span>${symHTML(x.c.r)}<span class="nm">${esc(x.c.name)}</span><span class="pr">${x.unit ? eur(x.unit) : ""}</span></div>
  </div>`;
function drawBody(items) {
  const box = $("#colbody"); if (!box) return;
  const qq = query.trim().toLowerCase();
  let list = sorted(items);
  if (qq) list = list.filter(x => x.c.name.toLowerCase().includes(qq) || (x.c.n || "").replace(/^0+/, "") === qq.replace(/^0+/, "") || (x.info.name || "").toLowerCase().includes(qq));
  if (!list.length) { box.innerHTML = `<div class="empty-state"><b>Aucune carte</b>Rien ne correspond à « ${esc(query)} ».</div>`; return; }
  if (pref.k === "set") {
    // grouped by extension, like a shelf of binders
    const groups = [];
    for (const x of list) { const g = groups[groups.length - 1]; if (g && g.info.id === x.info.id) g.items.push(x); else groups.push({ info: x.info, items: [x] }); }
    let i = 0;
    box.innerHTML = groups.map(g => {
      const total = (S.SERIES || []).flatMap(s => s.sets).find(t => t.id === g.info.id)?.total || g.info.total || 0;
      const val = g.items.reduce((a, x) => a + x.val, 0);
      return `<section class="colset"><div class="colhead">${logoImg(g.info.id, g.info.logo, g.info.name, g.info.serie?.id, true)}<h3><a href="#/set/${encodeURIComponent(g.info.id)}" style="text-decoration:none">${esc(g.info.name)}</a></h3><a class="note slink" href="#/stats/${encodeURIComponent(g.info.id)}">${g.items.length}${total ? ` / ${total}` : ""} cartes · ${eur(val)} · Stats ›</a></div>
        <div class="grid">${g.items.map(x => tile(x, i++)).join("")}</div></section>`;
    }).join("");
  } else {
    box.innerHTML = `<div class="grid colflat">${list.map(tile).join("")}</div>`;
  }
  box.onclick = e => {
    const b = e.target.closest("[data-i]"); if (!b) return;
    const seq = list.map(x => x.c);
    openCardIn(seq[+b.dataset.i], seq);
  };
}
function openCardIn(c, seq) { const prev = S.CUR; S.CUR = null; openCard(c, seq); S.CUR = prev; }
export function openCardWithInfo(c, seq, info) { const prev = S.CUR; S.CUR = { data: { info } }; openCard(c, seq); S.CUR = prev; }
