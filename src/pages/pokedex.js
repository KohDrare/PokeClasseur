import { DEX_NAMES } from "../data/dex-names.js";
import { scanBase } from "../data/set-patches.js";
import { getJSON, img, loadSeries, loadSet, peekSet, pool } from "../data/tcgdex.js";
import { $, API, ICON, esc } from "../lib/core.js";
import { LS } from "../lib/storage.js";
import { setNav } from "../lib/ui.js";
import { ownedAny, saveCol } from "../state/collection.js";
import { S } from "../state/shared.js";

/* ================= POKÉDEX ================= */
export const REGIONS = [
  { id: "national", name: "National", from: 1, to: 1025, art: [133, 25] },
  { id: "kanto", name: "Kanto", from: 1, to: 151, art: [1, 4, 7] },
  { id: "johto", name: "Johto", from: 152, to: 251, art: [155, 152, 158] },
  { id: "hoenn", name: "Hoenn", from: 252, to: 386, art: [258, 252, 255] },
  { id: "sinnoh", name: "Sinnoh", from: 387, to: 493, art: [387, 390, 393] },
  { id: "unys", name: "Unys", from: 494, to: 649, art: [498, 495, 501] },
  { id: "kalos", name: "Kalos", from: 650, to: 721, art: [650, 656, 653] },
  { id: "alola", name: "Alola", from: 722, to: 809, art: [725, 722, 728] },
  { id: "galar", name: "Galar", from: 810, to: 898, art: [816, 810, 813] },
  { id: "hisui", name: "Hisui", from: 899, to: 905, art: [900, 899, 901] },
  { id: "paldea", name: "Paldea", from: 906, to: 1025, art: [906, 909, 912] }
];
export const sprite = n => `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/home/${n}.png`;
export const artwork = n => `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${n}.png`;
export const dexNo = n => "N° " + String(n).padStart(4, "0");
export const regionOf = n => REGIONS.slice(1).find(r => n >= r.from && n <= r.to);

/* how many owned cards show each Pokémon */
export function dexCounts() {
  const m = new Map();
  for (const e of Object.values(S.COL.cards)) {
    if (!e.d || !Object.values(e.v || {}).some(n => n > 0)) continue;
    for (const n of new Set(e.d)) m.set(n, (m.get(n) || 0) + 1);
  }
  return m;
}
/* cards ticked before their details were known have no Pokédex number yet: look them up once */
export async function backfillDex() {
  const todo = Object.entries(S.COL.cards).filter(([, e]) => !e.d);
  if (!todo.length) return false;
  const sets = {};
  for (const [id, e] of todo) (sets[e.s] ||= []).push(id);
  for (const [sid, ids] of Object.entries(sets)) {
    const s = await peekSet(sid); const m = new Map((s?.cards || []).filter(c => c.ok).map(c => [c.id, c]));
    await pool(ids, 8, async id => {
      const c = m.get(id);
      if (c) { S.COL.cards[id].d = c.dx || []; return; }
      try { const d = await getJSON(`${API}/cards/${encodeURIComponent(id)}`); if (d && S.COL.cards[id]) S.COL.cards[id].d = d.dexId || []; } catch {}
    });
  }
  saveCol();
  return true;
}

export let dexQuery = "", dexOwn = "all";
export async function renderPokedex(regionId) {
  setNav("dex"); S.CUR = null;
  const app = $("#app");
  const region = regionId ? REGIONS.find(r => r.id === regionId) : null;
  if (regionId && !region) { location.hash = "#/pokedex"; return; }
  const missingDex = Object.values(S.COL.cards).some(e => !e.d);
  if (!region) {
    app.innerHTML = `<section class="band"><div class="wrap">
        <h1>Pokédex</h1><p class="sub">Il se remplit tout seul : chaque carte Pokémon que tu coches ajoute ce Pokémon à ton Pokédex.</p>
      </div></section>
      <div class="wrap"><div class="toolbar"><label class="search" for="q-dex">${ICON.search}<input id="q-dex" placeholder="Rechercher un Pokémon par nom ou n°…" autocomplete="off"></label></div>
      <div id="dexbody"></div></div>`;
    const drawRegions = () => {
      const cnt = dexCounts();
      $("#dexbody").innerHTML = `<div class="regions">${REGIONS.map(r => {
        let o = 0; for (let n = r.from; n <= r.to; n++) if (cnt.has(n)) o++;
        const tot = r.to - r.from + 1, pct = o / tot * 100;
        return `<a class="region" href="#/pokedex/${r.id}">
          <div class="rinfo"><div class="rtop"><b>${r.name}</b><span><b>${o}</b>/${tot}</span></div><div class="bar ${o === tot ? "full" : ""}"><i style="width:${Math.max(pct, o ? 1.5 : 0)}%"></i></div></div>
          <div class="rart">${r.art.map(n => `<img src="${sprite(n)}" alt="" loading="lazy">`).join("")}</div>
        </a>`;
      }).join("")}</div>`;
    };
    drawRegions();
    $("#q-dex").oninput = e => { dexQuery = e.target.value; if (dexQuery.trim()) location.hash = "#/pokedex/national"; };
    if (missingDex && await backfillDex()) drawRegions();
    return;
  }
  const tot = region.to - region.from + 1;
  app.innerHTML = `<section class="band"><div class="wrap">
      <a class="crumb" href="#/pokedex">${ICON.back} Pokédex</a>
      <div class="dexhead"><div><h1>${region.name}</h1><p class="sub">${dexNo(region.from)} à ${dexNo(region.to)}</p></div>
      <div class="progress" id="dexprog"></div></div>
    </div></section>
    <div class="wrap">
      <div class="toolbar">
        <label class="search" for="q-dex">${ICON.search}<input id="q-dex" placeholder="Rechercher un Pokémon par nom ou n°…" value="${esc(dexQuery)}" autocomplete="off"></label>
        <div class="seg" id="dex-own"><button data-o="all" class="${dexOwn === "all" ? "on" : ""}">Tous</button><button data-o="have" class="${dexOwn === "have" ? "on" : ""}">Attrapés</button><button data-o="miss" class="${dexOwn === "miss" ? "on" : ""}">Manquants</button></div>
      </div>
      <div id="dexbody"></div>
    </div>`;
  const draw = () => {
    const cnt = dexCounts();
    let o = 0; for (let n = region.from; n <= region.to; n++) if (cnt.has(n)) o++;
    const pct = Math.round(o / tot * 100);
    $("#dexprog").innerHTML = `<div class="ring" style="--p:${pct}" data-l="${pct}%"></div><div><div class="t">${o} / ${tot}</div><div class="s">Pokémon attrapés en carte</div></div>`;
    const q = dexQuery.trim().toLowerCase().replace(/^n°\s*/, "");
    const norm = t => t.normalize("NFD").replace(/[̀-ͯ]/g, "");
    const list = [];
    for (let n = region.from; n <= region.to; n++) {
      const name = DEX_NAMES[n - 1] || "#" + n;
      if (q && !(norm(name.toLowerCase()).includes(norm(q)) || String(n) === q.replace(/^0+/, ""))) continue;
      const have = cnt.has(n);
      if (dexOwn === "have" && !have) continue;
      if (dexOwn === "miss" && have) continue;
      list.push(n);
    }
    $("#dexbody").innerHTML = list.length ? `<div class="mons">${list.map(n => {
      const c = cnt.get(n) || 0;
      return `<button class="mon ${c ? "got" : ""}" data-n="${n}"><span class="mimg"><img src="${sprite(n)}" alt="" loading="lazy" decoding="async"></span>${c ? `<span class="mcount">${c} carte${c > 1 ? "s" : ""}</span>` : ""}<span class="mno">${dexNo(n)}</span><span class="mname">${esc(DEX_NAMES[n - 1])}</span></button>`;
    }).join("")}</div>` : `<div class="empty-state"><b>Aucun Pokémon</b>${dexOwn === "have" ? "Coche des cartes Pokémon dans tes extensions pour les attraper ici." : "Essaie un autre nom ou numéro."}</div>`;
  };
  draw();
  $("#q-dex").oninput = e => { dexQuery = e.target.value; draw(); };
  $("#dex-own").onclick = e => { const b = e.target.closest("button"); if (!b) return; dexOwn = b.dataset.o; [...e.currentTarget.children].forEach(x => x.classList.toggle("on", x === b)); draw(); };
  $("#dexbody").onclick = e => { const b = e.target.closest(".mon"); if (b) openMon(+b.dataset.n); };
  if (missingDex && await backfillDex()) draw();
}

export const MON_CARDS = new Map();
/* the Pokémon's page. `over`: opened from a card, on top of it; closing it goes back to that card */
export function openMon(n, over = null, scrollTo = 0) {
  const name = DEX_NAMES[n - 1], reg = regionOf(n);
  return openCardsSheet({
    key: "mon:" + n, label: name, cls: "monsheet",
    hero: `<div class="monhero"><img src="${artwork(n)}" alt="${esc(name)}"><div><div class="mno">${dexNo(n)}${reg ? " · " + reg.name : ""}</div><h2>${esc(name)}</h2><div id="monstatus" class="note"></div></div></div>`,
    url: `${API}/cards?dexId=eq:${n}`,
    status: (mine, all) => mine ? `<span class="okchip">${ICON.check} Attrapé · ${mine} carte${mine > 1 ? "s" : ""}</span> sur ${all} existantes` : `Pas encore dans ta collection · ${all} cartes existantes`,
    reopen: (o, y) => openMon(n, o, y)
  }, over, scrollTo);
}
/* every card drawn by an illustrator (from a card's "Illustrateur"), newest first */
export function openArtist(name, over = null, scrollTo = 0) {
  return openCardsSheet({
    key: "il:" + name, label: name, cls: "monsheet artistsheet", byDate: true,
    hero: `<div class="monhero"><div class="arthero"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a9 9 0 0 0 0 18c1.1 0 1.6-.8 1.6-1.6 0-.9-.6-1.3-.6-2.1 0-.9.7-1.5 1.6-1.5H17a4 4 0 0 0 4-4C21 6.8 17 3 12 3z"/><circle cx="7.5" cy="11" r="1.2"/><circle cx="10" cy="7" r="1.2"/><circle cx="14.5" cy="7" r="1.2"/><circle cx="17" cy="11" r="1.2"/></svg></div><div><div class="mno">Illustrateur</div><h2>${esc(name)}</h2><div id="monstatus" class="note"></div></div></div>`,
    url: `${API}/cards?illustrator=eq:${encodeURIComponent(name)}`,
    status: (mine, all) => `${all} carte${all > 1 ? "s" : ""} illustrée${all > 1 ? "s" : ""}${mine ? ` · <span class="okchip">${ICON.check} ${mine} dans ta collection</span>` : ""}`,
    reopen: (o, y) => openArtist(name, o, y)
  }, over, scrollTo);
}
/* the sheet listing cards (a Pokémon's, an illustrator's). over: opened from a card, on top of it */
async function openCardsSheet(spec, over, scrollTo) {
  let root = $("#modal-root");
  if (over) { root = document.getElementById("modal-stack") || document.body.appendChild(Object.assign(document.createElement("div"), { id: "modal-stack" })); }
  const q = sel => root.querySelector(sel);
  root.innerHTML = `<div class="modal" id="mdl"><div class="sheet ${spec.cls}" role="dialog" aria-modal="true" aria-label="${esc(spec.label)}">
    <button class="iconbtn close" id="m-close" aria-label="Fermer">${ICON.x}</button>
    ${spec.hero}
    <div id="moncards"><div class="empty-state" style="padding:30px 0"><b>Recherche des cartes…</b></div></div>
  </div></div>`;
  const close = () => { root.innerHTML = ""; if (!over) document.body.style.overflow = ""; document.removeEventListener("keydown", key, true); };
  const key = e => { if (e.key === "Escape") { e.stopImmediatePropagation(); close(); } };
  document.addEventListener("keydown", key, true); document.body.style.overflow = "hidden";
  q("#m-close").onclick = close; q("#mdl").onclick = e => { if (e.target.id === "mdl") close(); };
  let all = MON_CARDS.get(spec.key);
  try { if (!all) { all = (await getJSON(spec.url)) || []; MON_CARDS.set(spec.key, all); } }
  catch { if (q("#moncards")) q("#moncards").innerHTML = `<div class="empty-state"><b>Impossible de charger les cartes</b>Vérifie ta connexion.</div>`; return; }
  if (!q("#moncards")) return;
  if (!S.SERIES) { try { S.SERIES = await loadSeries(); } catch {} }
  if (!q("#moncards")) return;
  // no TCGdex picture yet (new extensions): the Pokécardex scan; TCG Pocket-like sets without either are left out
  const pic = c => c.image ? `${c.image}/low.webp` : img(scanBase(c.id.slice(0, c.id.lastIndexOf("-")), c.localId));
  if (spec.byDate) {
    // newest extension first (the series list starts with the newest), then card number
    const rank = new Map((S.SERIES || []).flatMap(x => x.sets).map((t, i) => [t.id, i]));
    const r = c => rank.get(c.id.slice(0, c.id.lastIndexOf("-"))) ?? 1e9;
    all = all.filter(pic).sort((x, y) => r(x) - r(y) || (parseInt(x.localId) || 0) - (parseInt(y.localId) || 0));
  }
  const mine = all.filter(c => ownedAny(c.id)), others = all.filter(c => !ownedAny(c.id) && pic(c));
  q("#monstatus").innerHTML = spec.status(mine.length, all.length);
  const tile = (c, own) => `<button class="tile ${own ? "owned" : "missing"}" data-card="${esc(c.id)}" style="border:0;background:none;padding:0;text-align:left"><span class="cardimg">${pic(c) ? `<img src="${pic(c)}" alt="${esc(c.name)}" loading="lazy" onerror="cardImgErr(this)">` : `<div class="fallback">${esc(c.name)}</div>`}</span><span class="cap"><span class="nm">${esc(spec.byDate ? c.name : setNameOf(c.id))}</span>${spec.byDate ? `<span class="pr">${esc(setNameOf(c.id))}</span>` : ""}</span></button>`;
  const oth = spec.byDate ? others : others.slice().reverse();
  q("#moncards").innerHTML = (mine.length ? `<div class="h3">Tes cartes (${mine.length})</div><div class="grid smallgrid">${mine.map(c => tile(c, 1)).join("")}</div>` : "")
    + (oth.length ? `<div class="h3">${mine.length ? "Celles qui te manquent" : "Toutes les cartes"} (${oth.length})</div><div class="grid smallgrid">${oth.map(c => tile(c, 0)).join("")}</div>` : "")
    + `<p class="note">Touche une carte pour l'ouvrir ; en la fermant, tu reviens ici.</p>`;
  if (scrollTo) { const sh = q(".sheet"); if (sh) sh.scrollTop = scrollTo; }
  // a card opens on top of this page; closing it comes back here (and, opened from a card, to that card after)
  q("#moncards").onclick = async e => {
    const b = e.target.closest("[data-card]"); if (!b) return;
    const id = b.dataset.card, sid = id.slice(0, id.lastIndexOf("-"));
    const y = q(".sheet")?.scrollTop || 0;
    let set = null;
    try { set = await loadSet(sid); } catch { /* offline */ }
    const card = set?.cards.find(c => c.id === id);
    if (!card) { window.PENDING_CARD = id; close(); over?.leave?.(); location.hash = "#/set/" + encodeURIComponent(sid); return; }
    card._info = set.info;
    close(); over?.leave?.();
    const { openCard } = await import("../components/card-modal.js");
    openCard(card, set.cards.filter(c => !c.linked).map(c => { c._info = set.info; return c; }), undefined, {
      onClose: () => { const under = over?.back?.(); spec.reopen(under ? { leave: () => under.close(true), back: over.back } : null, y); }
    });
  };
}
export function setNameOf(cardId) {
  const sid = cardId.slice(0, cardId.lastIndexOf("-"));
  if (S.SERIES) for (const s of S.SERIES) { const t = s.sets.find(x => x.id === sid); if (t) return t.name; }
  const sl = LS.get("pc-series", null); if (sl) for (const s of sl.data) { const t = s.sets.find(x => x.id === sid); if (t) return t.name; }
  return sid.toUpperCase();
}
