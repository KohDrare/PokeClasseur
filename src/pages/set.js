import { openCard } from "../components/card-modal.js";
import { PCX } from "../data/pokecardex-map.js";
import { codeBadge, img, loadSet, logoImg } from "../data/tcgdex.js";
import { openProducts } from "../features/products.js";
import { rarity, symHTML, symSVG } from "../features/rarity.js";
import { VARIANT_LABEL, eur, foilOf, fxHTML, mainVariant, priceOf, variantShort, variantsOf } from "../features/variants.js";
import { $, ICON, esc } from "../lib/core.js";
import { LS } from "../lib/storage.js";
import { fmtDate, imgTag, numLabel, setNav } from "../lib/ui.js";
import { SETMETA } from "./home.js";
import { ownedAny, qtyOf, setQty } from "../state/collection.js";
import { PREF, savePref } from "../state/prefs.js";
import { S } from "../state/shared.js";

/* ================= SET ================= */
S.CUR = null; // { setId, data, rar:Set, q, page }
export async function renderSet(setId) {
  setNav("series");
  const keep = S.CUR && S.CUR.setId === setId ? S.CUR : null;
  S.CUR = { setId, data: null, rar: keep?.rar || new Set(), q: keep?.q || "", page: keep?.page || 0, loading: 0 };
  const app = $("#app");
  app.innerHTML = `<section class="band"><div class="wrap" id="sethead"><a class="crumb" href="#/">${ICON.back} Séries internationales</a><div class="empty-state"><b>Chargement de l'extension…</b></div></div></section><div class="wrap" id="setbody"></div>`;
  let first = true;
  try {
    const data = await loadSet(setId, (partial, p) => {
      S.CUR.data = partial; S.CUR.loading = p;
      if (first) { first = false; drawSetHead(); drawSetBody(); }
      else { const b = $("#loadbar i"); if (b) b.style.width = Math.round(p * 100) + "%"; }
    });
    if (S.CUR.setId !== setId) return;
    S.CUR.data = data; S.CUR.loading = 1;
    if (data.info) { SETMETA[setId] = { a: data.info.abbr || "", d: data.info.date || "" }; LS.set("pc-setmeta", SETMETA); }
    drawSetHead(); drawSetBody();
    if (window.PENDING_CARD) { const c = data.cards.find(x => x.id === window.PENDING_CARD); window.PENDING_CARD = null; if (c) openCard(c, data.cards); }
  } catch {
    $("#sethead").innerHTML = `<a class="crumb" href="#/">${ICON.back} Séries internationales</a><div class="empty-state"><b>Impossible de charger cette extension</b>Vérifie ta connexion puis réessaie.</div>`;
  }
}
export function setCounts() {
  const cs = S.CUR.data.cards;
  let own = 0, vOwn = 0, vTot = 0;
  for (const c of cs) { if (ownedAny(c.id)) own++; for (const v of variantsOf(c)) { vTot++; if (qtyOf(c.id, v)) vOwn++; } }
  return { own, total: cs.length, vOwn, vTot };
}
export function drawSetHead() {
  const { info } = S.CUR.data, k = setCounts();
  const pct = k.total ? Math.round(k.own / k.total * 100) : 0;
  const secret = Math.max(0, info.total - (info.official || info.total));
  $("#sethead").innerHTML = `<a class="crumb" href="#/">${ICON.back} ${esc(info.serie?.name || "Séries")}</a>
    <h1 class="titlecenter">${esc(info.name)}</h1>
    <div class="sethero">
      <div class="logo">${logoImg(info.id, info.logo, info.name, info.serie?.id, true)}</div>
      <div class="meta">
        <div class="chips">
          ${PCX[info.id] || info.abbr ? `<span class="chip">${codeBadge(info.id, info.abbr)}</span>` : ""}
          <span class="chip">${esc(info.id.toUpperCase())}</span>
          ${info.date ? `<span class="chip">${ICON.cal} ${fmtDate(info.date)}</span>` : ""}
        </div>
        <div class="chips">
          <span class="chip">${ICON.cards} ${info.total} cartes</span>
          ${secret ? `<span class="chip">${ICON.star} ${secret} secrètes</span>` : ""}
        </div>
        <a class="progress plink" id="prog" href="#/stats/${encodeURIComponent(info.id)}" title="Voir les stats de ta collection">
          <div class="ring" style="--p:${pct}" data-l="${pct}%"></div>
          <div><div class="t">${k.own} / ${k.total} cartes</div><div class="s">${k.vOwn} / ${k.vTot} versions (reverse compris)</div></div>
          <span class="go"><span>Stats</span>${ICON.next}</span>
        </a>
        <div class="herobtns"><button class="pill" id="hb-check"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1M9 10h6M9 14h6M9 18h3"/></svg> Checklist</button><button class="pill" id="hb-prod"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9z"/><path d="m4 7.5 8 4.5 8-4.5M12 12v9"/></svg> Produits${(() => { const n = (S.COL.products?.[info.id] || []).reduce((a, p) => a + p.qty, 0); return n ? ` <em class="pcount">${n}</em>` : ""; })()}</button></div>
      </div>
    </div>`;
  bindHeroButtons();
}
export function bindHeroButtons() {
  const c = $("#hb-check"), pr = $("#hb-prod"); if (!c) return;
  c.onclick = () => { PREF.view = "list"; savePref(); S.CUR.page = 0; drawSetBody(); $("#cards").scrollIntoView({ block: "start", behavior: "smooth" }); };
  pr.onclick = () => openProducts(S.CUR.data.info);
}
export function refreshProgress() {
  const p = $("#prog"); if (!p) return;
  const k = setCounts(), pct = k.total ? Math.round(k.own / k.total * 100) : 0;
  p.innerHTML = `<div class="ring" style="--p:${pct}" data-l="${pct}%"></div><div><div class="t">${k.own} / ${k.total} cartes</div><div class="s">${k.vOwn} / ${k.vTot} versions (reverse compris)</div></div><span class="go"><span>Stats</span>${ICON.next}</span>`;
}
export function rarityGroups() {
  const m = new Map();
  for (const c of S.CUR.data.cards) { if (!c.ok) continue; const r = rarity(c.r); const key = r.sym + "|" + r.cls; if (!m.has(key)) m.set(key, { ...r, labels: new Set(), key, n: 0 }); m.get(key).labels.add(c.r || "Sans rareté"); m.get(key).n++; }
  return [...m.values()].sort((a, b) => a.rank - b.rank);
}
export function drawSetBody() {
  const body = $("#setbody");
  const groups = rarityGroups();
  const k = setCounts();
  const ready = S.CUR.loading >= 1;
  body.innerHTML = `
    <div class="toolbar">
      <div class="rar"><button class="rbtn ${PREF.own === "have" ? "on" : ""}" id="rb-have" title="Cartes possédées"><svg class="rsvg" viewBox="0 0 22 22" aria-hidden="true"><circle cx="11" cy="11" r="8.3" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M7.2 11.3l2.6 2.6 5-5.2" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg></button>${groups.map(g => `<button class="rbtn ${S.CUR.rar.has(g.key) ? "on" : ""}" data-r="${esc(g.key)}" title="${esc([...g.labels].join(" · "))} (${g.n})"><span class="sym">${symSVG(g.sym)}</span></button>`).join("")}</div>
      <label class="search" for="q-cards">${ICON.search}<input id="q-cards" placeholder="Rechercher une carte (nom ou numéro)" value="${esc(S.CUR.q)}" autocomplete="off"></label>
      <button class="toggle ${PREF.versions ? "on" : ""}" id="tg-versions" title="Afficher chaque version (normale, reverse…) séparément">${ICON.versions} Afficher les versions</button>
    </div>
    ${ready ? "" : `<div class="loadbar" id="loadbar"><i style="width:${Math.round(S.CUR.loading * 100)}%"></i></div>`}
    <div class="row2">
      <div class="seg" id="seg-own">
        <button data-o="all" class="${PREF.own === "all" ? "on" : ""}">Toutes <em>${k.total}</em></button>
        <button data-o="have" class="${PREF.own === "have" ? "on" : ""}">Possédées <em>${k.own}</em></button>
        <button data-o="miss" class="${PREF.own === "miss" ? "on" : ""}">Manquantes <em>${k.total - k.own}</em></button>
      </div>
      <div class="seg" id="seg-view">
        <button data-v="grid" class="${PREF.view === "grid" ? "on" : ""}">${ICON.grid} Grille</button>
        <button data-v="binder" class="${PREF.view === "binder" ? "on" : ""}">${ICON.book} Classeur</button>
        <button data-v="list" class="${PREF.view === "list" ? "on" : ""}">${ICON.list} Checklist</button>
      </div>
    </div>
    <div id="cards"></div>`;
  const setOwn = o => { PREF.own = o; savePref(); S.CUR.page = 0; [...$("#seg-own").children].forEach(x => x.classList.toggle("on", x.dataset.o === o)); $("#rb-have").classList.toggle("on", o === "have"); drawCards(); };
  $("#rb-have").onclick = () => setOwn(PREF.own === "have" ? "all" : "have");
  body.querySelectorAll(".rbtn[data-r]").forEach(b => b.onclick = () => { const r = b.dataset.r; S.CUR.rar.has(r) ? S.CUR.rar.delete(r) : S.CUR.rar.add(r); b.classList.toggle("on"); S.CUR.page = 0; drawCards(); });
  $("#q-cards").oninput = e => { S.CUR.q = e.target.value; S.CUR.page = 0; drawCards(); };
  $("#tg-versions").onclick = e => { PREF.versions = !PREF.versions; savePref(); e.currentTarget.classList.toggle("on", PREF.versions); S.CUR.page = 0; drawCards(); };
  $("#seg-own").onclick = e => { const b = e.target.closest("button"); if (b) setOwn(b.dataset.o); };
  $("#seg-view").onclick = e => { const b = e.target.closest("button"); if (!b) return; PREF.view = b.dataset.v; savePref(); S.CUR.page = 0; [...e.currentTarget.children].forEach(x => x.classList.toggle("on", x === b)); drawCards(); if (PREF.view === "binder") $("#cards").scrollIntoView({ block: "start", behavior: "smooth" }); };
  drawCards();
}
export function refreshCounts() {
  const k = setCounts(); const seg = $("#seg-own"); if (!seg) return;
  const ems = seg.querySelectorAll("em"); ems[0].textContent = k.total; ems[1].textContent = k.own; ems[2].textContent = k.total - k.own;
  refreshProgress();
}
/* entries = cards (or card×variant when versions shown), after filters */
export function entries(cardLevel) {
  const q = S.CUR.q.trim().toLowerCase();
  let list = S.CUR.data.cards.filter(c => {
    if (S.CUR.rar.size) { const r = rarity(c.r); if (!c.ok || !S.CUR.rar.has(r.sym + "|" + r.cls)) return false; }
    if (q && !(c.name.toLowerCase().includes(q) || c.n.toLowerCase() === q || c.n.replace(/^0+/, "") === q.replace(/^0+/, ""))) return false;
    return true;
  });
  let out = PREF.versions && !cardLevel ? list.flatMap(c => variantsOf(c).map(v => ({ c, v }))) : list.map(c => ({ c, v: null }));
  const has = e => e.v ? qtyOf(e.c.id, e.v) > 0 : ownedAny(e.c.id);
  if (PREF.own === "have") out = out.filter(has);
  if (PREF.own === "miss") out = out.filter(e => !has(e));
  return out;
}
export function drawCards() {
  const box = $("#cards"); if (!box) return;
  const list = entries();
  if (!list.length) {
    box.innerHTML = `<div class="empty-state"><b>${PREF.own === "have" ? "Aucune carte cochée ici" : PREF.own === "miss" ? "Rien ne manque, bravo !" : "Aucune carte"}</b>${PREF.own === "have" ? "Coche le rond en haut à droite d'une carte pour l'ajouter à ta collection." : "Change les filtres pour voir d'autres cartes."}</div>`;
    return;
  }
  if (PREF.view === "binder") return drawBinder(box, entries(true));
  if (PREF.view === "list") return drawList(box, list);
  const info = S.CUR.data.info;
  box.innerHTML = `<div class="grid">${list.map(({ c, v }, i) => {
    const owned = v ? qtyOf(c.id, v) > 0 : ownedAny(c.id);
    const q = v ? qtyOf(c.id, v) : Object.values(S.COL.cards[c.id]?.v || {}).reduce((a, b) => a + b, 0);
    const price = v ? priceOf(c, v) : c.p;
    return `<div class="tile ${owned ? "owned" : "missing"}" data-i="${i}">
      <button class="cardimg" data-open="${i}" aria-label="Voir ${esc(c.name)}">${imgTag(c, "low")}${fxHTML(foilOf(c, v))}${v ? `<span class="vtag">${esc(variantShort(c, v))}</span>` : ""}</button>
      ${q > 1 ? `<span class="qty">×${q}</span>` : ""}
      <button class="check" data-tog="${i}" aria-pressed="${owned}" aria-label="${owned ? "Retirer" : "Ajouter"} ${esc(c.name)}">${ICON.check}</button>
      <div class="cap"><span class="n">${esc(numLabel(c, info))}</span>${c.ok ? symHTML(c.r) : ""}<span class="nm">${esc(c.name)}</span><span class="pr">${price ? eur(price) : ""}</span></div>
    </div>`;
  }).join("")}</div>`;
  box.onclick = e => {
    const t = e.target.closest("[data-tog]"); const o = e.target.closest("[data-open]");
    if (t) { const { c, v } = list[+t.dataset.tog]; quickToggle(c, v); }
    else if (o) { const { c, v } = list[+o.dataset.open]; openCard(c, [...new Map(list.map(x => [x.c.id, x.c])).values()], v); }
  };
}
export function quickToggle(c, v) {
  if (v) setQty(c, v, qtyOf(c.id, v) ? 0 : 1);
  else if (ownedAny(c.id)) { for (const k of Object.keys(S.COL.cards[c.id].v)) setQty(c, k, 0); }
  else setQty(c, mainVariant(c), 1);
  if (PREF.own === "all") updateTilesFor(c); else drawCards();
  refreshCounts();
}
export function updateTilesFor(c) {
  // cheap redraw: re-render current view (keeps scroll)
  const y = scrollY; drawCards(); scrollTo(0, y);
}
export function drawBinder(box, list) {
  const info = S.CUR.data.info;
  const PER = 9, wide = matchMedia("(min-width: 861px)").matches, spread = wide ? 2 : 1;
  const pages = Math.ceil(list.length / PER);
  const pageCount = Math.max(1, Math.ceil(pages / spread));
  S.CUR.page = Math.min(S.CUR.page, pageCount - 1);
  const start = S.CUR.page * spread;
  const slotHTML = p => {
    const slots = list.slice(p * PER, p * PER + PER);
    return slots.map(({ c, v }, j) => {
      const i = p * PER + j; const owned = v ? qtyOf(c.id, v) > 0 : ownedAny(c.id);
      return owned
        ? `<button class="slot has" data-open="${i}" aria-label="${esc(c.name)}"><span class="slotcard">${imgTag(c, "high")}${fxHTML(foilOf(c))}</span><span class="shine"></span></button>`
        : `<button class="slot" data-open="${i}" aria-label="${esc(c.name)} (manquante)"><div class="empty">${c.img ? `<div class="ghost" style="background-image:url('${img(c.img, "low")}')"></div>` : ""}<b>${esc(numLabel(c, info))}</b><span>${esc(c.name)}</span></div></button>`;
    }).join("") + Array.from({ length: PER - slots.length }, () => `<div class="slot" aria-hidden="true"></div>`).join("");
  };
  const pageHTML = (p, side) => p < pages
    ? `<div class="page ${side}"><div class="slots">${slotHTML(p)}</div><div class="pagenum">${p + 1}</div></div>`
    : `<div class="page ${side} blank"><div class="slots">${Array.from({ length: PER }, () => `<div class="slot" aria-hidden="true"></div>`).join("")}</div><div class="pagenum">&nbsp;</div></div>`;
  const rings = `<div class="spine" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></div>`;
  let html = spread === 2
    ? `<div class="binder">${pageHTML(start, "left")}${rings}${pageHTML(start + 1, "right")}`
    : `<div class="binder single">${rings}${pageHTML(start, "right")}`;
  html += `</div><div class="pager"><button class="pill ghost" id="pg-prev" ${S.CUR.page === 0 ? "disabled" : ""}>${ICON.prev} Précédent</button><span>${spread === 2 ? `Pages ${start + 1}–${Math.min(start + 2, pages)}` : `Page ${start + 1}`} / ${pages}</span><button class="pill ghost" id="pg-next" ${S.CUR.page >= pageCount - 1 ? "disabled" : ""}>Suivant ${ICON.next}</button></div>`;
  box.innerHTML = html;
  const go = d => { const np = S.CUR.page + d; if (np < 0 || np >= pageCount) return; S.CUR.page = np; drawCards(); $("#cards").scrollIntoView({ block: "start", behavior: "smooth" }); };
  $("#pg-prev").onclick = () => go(-1);
  $("#pg-next").onclick = () => go(1);
  const bd = box.querySelector(".binder"); let sx = null, sy = 0;
  bd.addEventListener("touchstart", e => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
  bd.addEventListener("touchend", e => { if (sx == null) return; const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy; sx = null; if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx < 0 ? 1 : -1); });
  box.onclick = e => { const o = e.target.closest("[data-open]"); if (o) openCard(list[+o.dataset.open].c, list.map(x => x.c)); };
}
export function drawList(box, list) {
  const info = S.CUR.data.info;
  const cards = [...new Map(list.map(e => [e.c.id, e.c])).values()];
  box.innerHTML = `<div class="legend" style="margin-bottom:12px"><span><i></i>Normale / Holo / 1re éd.</span><span><i class="r"></i>Reverse</span><span>Clique sur un nom pour voir la carte.</span></div>
  <div class="list">${cards.map((c, i) => `<div class="li"><span class="n">${esc(numLabel(c, info))}</span>${c.ok ? symHTML(c.r) : ""}<span class="nm" data-open="${i}">${esc(c.name)}</span><span class="boxes">${variantsOf(c).map(v => `<button class="box ${v === "reverse" ? "r" : ""} ${qtyOf(c.id, v) ? "on" : ""}" data-c="${i}" data-v="${v}" title="${VARIANT_LABEL[v]}" aria-label="${VARIANT_LABEL[v]} ${esc(c.name)}" aria-pressed="${!!qtyOf(c.id, v)}">${qtyOf(c.id, v) ? ICON.check : ""}</button>`).join("")}</span></div>`).join("")}</div>`;
  box.onclick = e => {
    const b = e.target.closest(".box"); const o = e.target.closest("[data-open]");
    if (b) { const c = cards[+b.dataset.c], v = b.dataset.v; setQty(c, v, qtyOf(c.id, v) ? 0 : 1); const on = !!qtyOf(c.id, v); b.classList.toggle("on", on); b.innerHTML = on ? ICON.check : ""; b.setAttribute("aria-pressed", on); refreshCounts(); }
    else if (o) openCard(cards[+o.dataset.open], cards);
  };
}
