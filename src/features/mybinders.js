/* Your own binders ("portfolios"): a name, a colour, the cards you pick from your collection.
   Kept on this device (localStorage), with a copy of each card's picture and name so they open instantly. */
import { openCard } from "../components/card-modal.js";
import { openViewer } from "../components/viewer.js";
import { $, ICON, esc } from "../lib/core.js";
import { LS } from "../lib/storage.js";
import { imgTag, numLabel, toast } from "../lib/ui.js";
import { BINDER_COLORS, openBinderView } from "./binderview.js";
import { SORTS, sortItems } from "./colsort.js";
import { rarity, symHTML } from "./rarity.js";

const KEY = "pc-binders";
export const myBinders = () => LS.get(KEY, []);
const saveAll = list => LS.set(KEY, list);
const snap = (c, info) => ({ id: c.id, setId: c.setId, n: c.n, name: c.name, img: c.img, r: c.r, label: numLabel(c, info) });

/* the row of binders in "Ma collection": "Nouveau" + one tile per binder */
export function drawBinderShelf(box, items, refresh) {
  const list = myBinders();
  box.innerHTML = `<div class="cp-hd2"><h2>Mes classeurs <em class="bcount">${list.length}</em></h2></div>
    <div class="shelf">
      <button class="btile new" id="bnew"><span class="bcover"><i>+</i></span><b>Nouveau</b><small>Choisis tes cartes</small></button>
      ${list.map((b, i) => `<button class="btile" data-b="${i}" style="--bc:${b.color}">
        <span class="bcover">${b.cards[0] ? `<span class="bmain">${imgTag(b.cards[0], "low")}</span>` : ""}<span class="bmini">${b.cards.slice(1, 4).map(c => `<span>${imgTag(c, "low")}</span>`).join("")}</span></span>
        <b>${esc(b.name)}</b><small>${b.cards.length} carte${b.cards.length > 1 ? "s" : ""}</small></button>`).join("")}
    </div>`;
  $("#bnew").onclick = () => openBinderEditor(null, items, refresh);
  box.querySelectorAll("[data-b]").forEach(t => t.onclick = () => openMyBinder(+t.dataset.b, items, refresh));
}

export function openMyBinder(i, items, refresh) {
  const b = myBinders()[i]; if (!b) return;
  const full = new Map(items.map(x => [x.c.id, x.c]));   // the full card when it is still in the collection
  const cards = b.cards.map(s => full.get(s.id) || s);
  openBinderView({
    title: b.name, color: b.color, mode: b.mode,
    slots: cards.map(c => ({ c, owned: true })),
    save: p => { const all = myBinders(); if (all[i]) { Object.assign(all[i], p); saveAll(all); refresh?.(); } },
    onEdit: () => openBinderEditor(i, items, refresh),
    onOpen: s => { if (!s.c.img) return; openViewer(s.c, full.has(s.c.id) ? () => openCard(s.c, cards.filter(c => full.has(c.id))) : null); }
  });
}

/* create / edit: name, colour, pages or scroll, and the cards (tap to add, the first one is the cover) */
export function openBinderEditor(i, items, refresh) {
  const all = myBinders();
  const cur = i == null ? { name: "", color: BINDER_COLORS[0], mode: "pages", cards: [] } : structuredClone(all[i]);
  let picked = cur.cards.map(c => c.id), q = "";
  let sk = "rar", sd = -1;               // sort: rarest first
  const rarOn = new Set();               // rarity filter
  const rkey = c => { const r = rarity(c.r); return r.sym + "|" + r.cls; };
  const groups = [...new Map(items.filter(x => x.c.r).map(x => [rkey(x.c), { k: rkey(x.c), r: x.c.r, rank: rarity(x.c.r).rank }])).values()].sort((a, b) => a.rank - b.rank);
  const SHORT = { num: "Numéro", type: "Type", rar: "Rareté", qty: "Exemplaires", set: "Extension", price: "Prix", fav: "Favoris" };
  const ARROW = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M6 11l6-6 6 6"/></svg>';
  const byId = new Map(items.map(x => [x.c.id, x]));
  const root = $("#modal-root");
  const offs = [];   // listeners to remove when the editor closes
  const close = () => { root.innerHTML = ""; document.body.style.overflow = ""; removeEventListener("keydown", key); offs.forEach(f => f()); };
  const key = e => { if (e.key === "Escape") close(); };
  addEventListener("keydown", key); document.body.style.overflow = "hidden";
  root.innerHTML = `<div class="modal" id="mdl"><div class="sheet beditor" role="dialog" aria-modal="true" aria-label="Classeur">
    <button class="iconbtn close" id="m-close" aria-label="Fermer">${ICON.x}</button>
    <h2>${i == null ? "Nouveau classeur" : "Modifier le classeur"}</h2>
    <label class="be-lbl" for="be-name">Nom</label>
    <input class="be-name" id="be-name" maxlength="40" placeholder="Par ex. AllOfHit, Mes Évoli, Full Art…" value="${esc(cur.name)}">
    <div class="be-row">
      <div><div class="be-lbl">Couleur</div><div class="be-colors" id="be-colors">${BINDER_COLORS.map(c => `<button class="bv-sw ${c === cur.color ? "on" : ""}" data-c="${c}" style="background:${c}" aria-label="Couleur ${c}"></button>`).join("")}</div></div>
      <div><div class="be-lbl">Affichage</div><div class="seg" id="be-mode"><button data-m="pages" class="${cur.mode === "pages" ? "on" : ""}">Pages</button><button data-m="scroll" class="${cur.mode === "scroll" ? "on" : ""}">Défilement</button></div></div>
    </div>
    <div class="seg be-tabs" id="be-tabs"><button data-t="pick" class="on">Choisir les cartes <em id="be-n"></em></button><button data-t="order">Ordre</button></div>
    <div id="be-pick">
    <label class="search" for="be-q">${ICON.search}<input id="be-q" placeholder="Rechercher dans ma collection" autocomplete="off"></label>
    <div class="be-tools"><span class="be-t">Trier</span><div class="be-chips" id="be-sort"></div></div>
    ${groups.length > 1 ? `<div class="be-tools"><span class="be-t">Rareté</span><div class="be-chips" id="be-rar">${groups.map(g => `<button class="be-chip" data-r="${esc(g.k)}" title="${esc(g.r)}">${symHTML(g.r)}</button>`).join("")}</div></div>` : ""}
    <div class="be-bulk"><button class="linkbtn" id="be-all"></button><button class="linkbtn" id="be-none">Tout retirer</button></div>
    <div class="be-grid" id="be-grid"></div>
    </div>
    <div id="be-order" hidden>
      <p class="note be-hint">Maintiens une carte puis fais-la glisser à sa place (sur ordinateur : clique et glisse). La première est la couverture.</p>
      <div class="be-tools"><span class="be-t">Ranger</span><div class="be-chips" id="be-auto"><button class="be-chip" data-a="rar">Plus rares d'abord</button><button class="be-chip" data-a="price">Plus chères d'abord</button><button class="be-chip" data-a="num">Par numéro</button><button class="be-chip" data-a="rev">Inverser</button></div></div>
      <div class="be-grid bo-grid" id="bo-grid"></div>
    </div>
    <div class="be-foot">${i == null ? "" : `<button class="linkbtn be-del" id="be-del">Supprimer</button>`}<button class="pill" id="be-save">Enregistrer</button></div>
  </div></div>`;
  const grid = $("#be-grid");
  let shown = [];
  const drawGrid = () => {
    const qq = q.trim().toLowerCase();
    // cards no longer in the collection stay listed while chosen
    const gone = picked.filter(id => !byId.has(id)).map(id => ({ c: cur.cards.find(c => c.id === id), info: {}, q: 1, val: 0, unit: 0, no: 0, date: "" })).filter(x => x.c);
    shown = sortItems([...items, ...gone], sk, sd).filter(x => (!qq || x.c.name.toLowerCase().includes(qq) || (x.info?.name || "").toLowerCase().includes(qq)) && (!rarOn.size || rarOn.has(rkey(x.c))));
    grid.innerHTML = shown.map(x => { const k = picked.indexOf(x.c.id);
      return `<button class="be-card ${k >= 0 ? "on" : ""}" data-id="${esc(x.c.id)}" aria-pressed="${k >= 0}">${imgTag(x.c, "low")}${k >= 0 ? `<span class="be-k">${k === 0 ? "★" : k + 1}</span>` : ""}</button>`; }).join("") || `<p class="note">Aucune carte.</p>`;
    $("#be-n").textContent = picked.length;
    const add = shown.filter(x => !picked.includes(x.c.id)).length;
    const all = $("#be-all"); all.textContent = `Tout ajouter (${add})`; all.disabled = !add;
    $("#be-none").disabled = !picked.length;
    $("#be-sort").innerHTML = SORTS.map(o => `<button class="be-chip ${o.k === sk ? "on" : ""}" data-k="${o.k}">${SHORT[o.k]}${o.k === sk ? `<i class="sdir ${sd > 0 ? "" : "down"}">${ARROW}</i>` : ""}</button>`).join("");
  };
  grid.onclick = e => {
    const b = e.target.closest("[data-id]"); if (!b) return;
    const id = b.dataset.id, k = picked.indexOf(id);
    if (k >= 0) picked.splice(k, 1); else picked.push(id);
    drawGrid();
  };
  $("#be-q").oninput = e => { q = e.target.value; drawGrid(); };
  $("#be-sort").onclick = e => { const b = e.target.closest("[data-k]"); if (!b) return; const o = SORTS.find(x => x.k === b.dataset.k); if (sk === o.k) sd = -sd; else { sk = o.k; sd = o.d; } drawGrid(); };
  const rb = $("#be-rar"); if (rb) rb.onclick = e => { const b = e.target.closest("[data-r]"); if (!b) return; const k = b.dataset.r; rarOn.has(k) ? rarOn.delete(k) : rarOn.add(k); b.classList.toggle("on", rarOn.has(k)); drawGrid(); };
  $("#be-all").onclick = () => { for (const x of shown) if (!picked.includes(x.c.id)) picked.push(x.c.id); drawGrid(); };
  $("#be-none").onclick = () => { picked = []; drawGrid(); };
  $("#be-colors").onclick = e => { const b = e.target.closest("[data-c]"); if (!b) return; cur.color = b.dataset.c; [...e.currentTarget.children].forEach(x => x.classList.toggle("on", x === b)); };
  $("#be-mode").onclick = e => { const b = e.target.closest("[data-m]"); if (!b) return; cur.mode = b.dataset.m; [...e.currentTarget.children].forEach(x => x.classList.toggle("on", x === b)); };
  $("#m-close").onclick = close;
  $("#mdl").onclick = e => { if (e.target.id === "mdl") close(); };
  $("#be-save").onclick = () => {
    cur.name = $("#be-name").value.trim() || "Mon classeur";
    if (!picked.length) { toast("Choisis au moins une carte"); return; }
    cur.cards = picked.map(id => byId.has(id) ? snap(byId.get(id).c, byId.get(id).info) : cur.cards.find(c => c.id === id)).filter(Boolean);
    const list = myBinders();
    if (i == null) list.push({ ...cur, id: "b" + Date.now().toString(36), created: Date.now() }); else list[i] = cur;
    saveAll(list); close(); refresh?.();
    toast(i == null ? "Classeur créé" : "Classeur enregistré");
  };
  const del = $("#be-del");
  if (del) del.onclick = () => {
    if (del.dataset.sure !== "1") { del.dataset.sure = "1"; del.textContent = "Supprimer pour de bon ?"; return; }
    const list = myBinders(); list.splice(i, 1); saveAll(list); close(); refresh?.(); toast("Classeur supprimé");
  };
  /* ---- order: drag the chosen cards (long press on a phone), or let the app arrange them ---- */
  const ogrid = $("#bo-grid");
  const cardOf = id => byId.get(id)?.c || cur.cards.find(c => c.id === id);
  const drawOrder = () => {
    ogrid.innerHTML = picked.map((id, k) => { const c = cardOf(id); return c ? `<div class="bo-item" data-id="${esc(id)}">${imgTag(c, "low")}<span class="be-k">${k === 0 ? "★" : k + 1}</span></div>` : ""; }).join("") || `<p class="note">Choisis d'abord des cartes.</p>`;
  };
  const renumber = () => ogrid.querySelectorAll(".bo-item").forEach((n, k) => { n.querySelector(".be-k").textContent = k === 0 ? "★" : k + 1; });
  $("#be-tabs").onclick = e => {
    const b = e.target.closest("[data-t]"); if (!b) return;
    [...e.currentTarget.children].forEach(x => x.classList.toggle("on", x === b));
    const order = b.dataset.t === "order";
    $("#be-pick").hidden = order; $("#be-order").hidden = !order;
    if (order) drawOrder(); else drawGrid();
  };
  $("#be-auto").onclick = e => {
    const b = e.target.closest("[data-a]"); if (!b) return;
    if (b.dataset.a === "rev") picked.reverse();
    else {
      const its = picked.map(id => byId.get(id) || { c: cardOf(id), info: {}, q: 1, val: 0, unit: 0, no: 0, date: "" }).filter(x => x.c);
      const d = b.dataset.a === "num" ? 1 : -1;
      picked = sortItems(its, b.dataset.a, d).map(x => x.c.id);
    }
    drawOrder();
  };
  let drag = null, timer = 0;
  const sheet = root.querySelector(".beditor");
  const startDrag = (item, x, y) => {
    const r = item.getBoundingClientRect();
    const ghost = item.cloneNode(true); ghost.className = "bo-item bo-ghost";
    Object.assign(ghost.style, { width: r.width + "px", height: r.height + "px", left: r.left + "px", top: r.top + "px" });
    document.body.append(ghost);
    item.classList.add("bo-hole");
    drag = { item, ghost, dx: x - r.left, dy: y - r.top };
    navigator.vibrate?.(15);
  };
  const moveDrag = (x, y) => {
    const { item, ghost, dx, dy } = drag;
    ghost.style.left = x - dx + "px"; ghost.style.top = y - dy + "px";
    const over = document.elementFromPoint(x, y)?.closest(".bo-item:not(.bo-ghost)");
    if (over && over !== item && over.parentElement === ogrid) {
      const r = over.getBoundingClientRect(), after = x > r.left + r.width / 2;
      ogrid.insertBefore(item, after ? over.nextSibling : over); renumber();
    }
    // scroll the sheet when the card is held near its top or bottom
    const sr = sheet.getBoundingClientRect();
    drag.auto = y < sr.top + 70 ? -8 : y > sr.bottom - 70 ? 8 : 0;
  };
  const endDrag = () => {
    clearTimeout(timer);
    if (!drag) return;
    drag.ghost.remove(); drag.item.classList.remove("bo-hole");
    picked = [...ogrid.querySelectorAll(".bo-item")].map(n => n.dataset.id);
    drag = null; renumber();
  };
  const iv = setInterval(() => { if (drag?.auto) sheet.scrollTop += drag.auto; }, 16);
  offs.push(() => { clearInterval(iv); drag?.ghost.remove(); });
  let p0 = null;
  ogrid.addEventListener("pointerdown", e => {
    const item = e.target.closest(".bo-item"); if (!item) return;
    p0 = { x: e.clientX, y: e.clientY, item };
    if (e.pointerType === "mouse") { e.preventDefault(); return; }
    timer = setTimeout(() => { if (p0) startDrag(item, p0.x, p0.y); }, 260);   // long press on touch screens
  });
  const onMove = e => {
    if (drag) { moveDrag(e.clientX, e.clientY); return; }
    if (!p0) return;
    const moved = Math.hypot(e.clientX - p0.x, e.clientY - p0.y);
    if (e.pointerType === "mouse" && moved > 4) startDrag(p0.item, p0.x, p0.y);
    else if (e.pointerType !== "mouse" && moved > 10) { clearTimeout(timer); p0 = null; }   // it was a scroll
  };
  const onUp = () => { p0 = null; endDrag(); };
  addEventListener("pointermove", onMove); addEventListener("pointerup", onUp); addEventListener("pointercancel", onUp);
  offs.push(() => { removeEventListener("pointermove", onMove); removeEventListener("pointerup", onUp); removeEventListener("pointercancel", onUp); });
  // while dragging with a finger, the page must not scroll
  ogrid.addEventListener("touchmove", e => { if (drag) e.preventDefault(); }, { passive: false });
  ogrid.addEventListener("contextmenu", e => e.preventDefault());

  drawGrid();
  if (i == null) setTimeout(() => $("#be-name")?.focus(), 50);
}
