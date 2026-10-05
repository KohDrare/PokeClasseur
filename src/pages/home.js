import { PCX } from "../data/pokecardex-map.js";
import { codeBadge, getJSON, loadSeries, logoImg, peekSet, pool } from "../data/tcgdex.js";
import { eur, priceOf } from "../features/variants.js";
import { $, API, ICON, esc } from "../lib/core.js";
import { LS } from "../lib/storage.js";
import { setNav } from "../lib/ui.js";
import { dexCounts } from "./pokedex.js";
import { ownedBySet } from "../state/collection.js";
import { S } from "../state/shared.js";

/* ================= HOME ================= */
S.SERIES = null;
export let homeQuery = "", homeMine = false;
export let SETMETA = LS.get("pc-setmeta", {});
export let metaBusy = false;
export async function fetchSetMeta() {
  if (metaBusy || !S.SERIES) return; metaBusy = true;
  const todo = S.SERIES.flatMap(s => s.sets).filter(t => !SETMETA[t.id]).map(t => t.id);
  let n = 0, timer = null;
  const flush = () => { LS.set("pc-setmeta", SETMETA); if ($("#series") && !location.hash.includes("/set/")) drawSeries(); };
  await pool(todo, 6, async id => {
    try { const d = await getJSON(`${API}/sets/${encodeURIComponent(id)}`); SETMETA[id] = { a: d?.abbreviation?.official || "", d: d?.releaseDate || "" }; } catch { return; }
    if (++n % 12 === 0) { clearTimeout(timer); timer = setTimeout(flush, 150); }
  });
  flush(); metaBusy = false;
}
export async function renderHome() {
  setNav("series");
  const app = $("#app");
  app.innerHTML = `<section class="band"><div class="wrap">
      <h1>Séries internationales</h1>
      <p class="sub">Choisis une extension pour cocher tes cartes et voir celles qui te manquent.</p>
      <div class="stats" id="stats"></div>
    </div></section>
    <div class="wrap">
      <div class="toolbar">
        <label class="search" for="q-sets">${ICON.search}<input id="q-sets" placeholder="Rechercher une extension" value="${esc(homeQuery)}" autocomplete="off"></label>
        <button class="toggle ${homeMine ? "on" : ""}" id="mine">${ICON.check.replace('stroke-width="3.2"','stroke-width="2.4"')} Mes extensions</button>
      </div>
      <div id="series"><div class="empty-state"><b>Chargement des séries…</b>La première ouverture prend quelques secondes.</div></div>
    </div>`;
  renderStats();
  $("#q-sets").oninput = e => { homeQuery = e.target.value; drawSeries(); };
  $("#mine").onclick = e => { homeMine = !homeMine; e.currentTarget.classList.toggle("on", homeMine); drawSeries(); };
  try { S.SERIES = S.SERIES || await loadSeries(); drawSeries(); fetchSetMeta(); }
  catch { $("#series").innerHTML = `<div class="empty-state"><b>Impossible de charger les séries</b>Vérifie ta connexion internet puis recharge la page.</div>`; }
}
export async function renderStats() {
  const by = ownedBySet();
  const cards = Object.values(by).reduce((a, b) => a + b.cards, 0);
  const copies = Object.values(S.COL.cards).reduce((a, e) => a + Object.values(e.v).reduce((x, y) => x + y, 0), 0);
  const el = $("#stats"); if (!el) return;
  el.innerHTML = `<div class="stat"><b>${cards.toLocaleString("fr-BE")}</b><span>cartes différentes</span></div>
    <div class="stat"><b>${copies.toLocaleString("fr-BE")}</b><span>exemplaires au total</span></div>
    <div class="stat"><b>${Object.keys(by).length}</b><span>extensions entamées</span></div>
    <div class="stat"><b id="val">…</b><span>valeur Cardmarket estimée</span></div>
    <a class="stat" href="#/pokedex" style="text-decoration:none"><b>${dexCounts().size} / 1025</b><span>Pokémon au Pokédex</span></a>`;
  const v = await collectionValue(); const vEl = $("#val"); if (vEl) vEl.textContent = eur(v);
}
export async function collectionValue() {
  let total = 0; const bySet = {};
  for (const [id, e] of Object.entries(S.COL.cards)) (bySet[e.s] ||= []).push([id, e]);
  for (const [sid, arr] of Object.entries(bySet)) {
    const s = await peekSet(sid); if (!s) continue;
    const m = new Map(s.cards.map(c => [c.id, c]));
    for (const [id, e] of arr) { const c = m.get(id); if (!c) continue; for (const [v, n] of Object.entries(e.v)) total += priceOf(c, v) * n; }
  }
  return total;
}
export function drawSeries() {
  const by = ownedBySet();
  const q = homeQuery.trim().toLowerCase();
  const html = S.SERIES.map(s => {
    let sets = s.sets.filter(t => (!q || t.name.toLowerCase().includes(q) || s.name.toLowerCase().includes(q) || t.id.toLowerCase() === q || (SETMETA[t.id]?.a || "").toLowerCase() === q) && (!homeMine || by[t.id]));
    if (!sets.length) return "";
    sets = sets.map((t, i) => [t, i]).sort((x, y) => { const dx = SETMETA[x[0].id]?.d || "", dy = SETMETA[y[0].id]?.d || ""; return dx && dy && dx !== dy ? dy.localeCompare(dx) : x[1] - y[1]; }).map(x => x[0]);
    return `<section class="serie"><h2>${esc(s.name)} <small>${sets.length} extension${sets.length > 1 ? "s" : ""}</small></h2><div class="sets">${sets.map(t => {
      const o = by[t.id]?.cards || 0, pct = t.total ? Math.round(o / t.total * 100) : 0, code = SETMETA[t.id]?.a;
      return `<a class="set" href="#/set/${encodeURIComponent(t.id)}" title="${esc(t.name)} · ${t.total} cartes">
        ${PCX[t.id] ? `<span class="badge img">${codeBadge(t.id)}</span>` : code ? `<span class="badge">${esc(code)}</span>` : ""}
        ${o ? `<span class="own ${o >= t.total ? "full" : ""}">${o}/${t.total}</span>` : ""}
        <div class="lg">${logoImg(t.id, t.logo, t.name, t.serie || s.id)}</div>
        ${o ? `<div class="bar ${o >= t.total ? "full" : ""}"><i style="width:${pct}%"></i></div>` : ""}
      </a>`;
    }).join("")}</div></section>`;
  }).join("");
  $("#series").innerHTML = html || `<div class="empty-state"><b>${homeMine ? "Aucune extension entamée" : "Aucune extension trouvée"}</b>${homeMine ? "Ouvre une extension et coche tes premières cartes." : "Essaie un autre nom."}</div>`;
}
