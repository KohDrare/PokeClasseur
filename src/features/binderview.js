/* Full-screen binder: only the cards, on a background colour you choose.
   Two ways to read it: pages of 3×3 you turn with a swipe, or one continuous scroll.
   Used by the set page (on phones) and by the binders you make yourself in "Ma collection". */
import { openViewer } from "../components/viewer.js";
import { img } from "../data/tcgdex.js";
import { $, ICON, esc } from "../lib/core.js";
import { LS } from "../lib/storage.js";
import { imgTag } from "../lib/ui.js";

export const BINDER_COLORS = ["#8e2a9e", "#25348f", "#0f1220", "#b3262f", "#1f7a4d", "#0d7c86", "#d9781b", "#e9ecf2"];
const PER = 9;
const svg = p => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
const I = {
  pages: svg('<path d="M12 6c-2-1.5-5-2-9-2v15c4 0 7 .5 9 2 2-1.5 5-2 9-2V4c-4 0-7 .5-9 2z"/><path d="M12 6v15"/>'),
  scroll: svg('<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h6"/>'),
  color: svg('<circle cx="12" cy="12" r="9"/><circle cx="8.5" cy="10" r="1.3" fill="currentColor"/><circle cx="12" cy="7.5" r="1.3" fill="currentColor"/><circle cx="15.5" cy="10" r="1.3" fill="currentColor"/><path d="M12 21a2.5 2.5 0 0 1 0-5h2a3 3 0 0 0 3-3"/>'),
  hide: svg('<path d="M3 3l18 18M10.6 6.1A10 10 0 0 1 12 6c5 0 9 6 9 6a17 17 0 0 1-3.2 3.8M6.7 6.7C4.3 8.3 3 12 3 12s4 6 9 6a9 9 0 0 0 4.3-1.1"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>'),
  edit: svg('<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>'),
  sort: svg('<path d="M7 4v16M3 16l4 4 4-4M17 20V4M13 8l4-4 4 4"/>'),
  gear: svg('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
  prev: ICON.prev, next: ICON.next
};
/* light or dark text on the chosen colour */
const ink = hex => { const n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255; return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? "#16192b" : "#ffffff"; };

/* opts: { title, slots:[{ c, owned, label }], color, mode: "pages"|"scroll", save(prefs), onEdit, onOpen(c, slots), onClose,
   editable: { startEdit, reorder(ids), arrange(key) → slots, onAdd, onSettings } — your own binders, edited in place:
   a "+" box at the end, and a card held then dropped on another one swaps places with it } */
const ARRANGE = [["rar", "Plus rares d'abord"], ["price", "Plus chères d'abord"], ["num", "Par numéro"], ["rev", "Inverser"]];
export function openBinderView(opts) {
  let { color, mode } = opts, page = 0, hidden = false;
  const ed = opts.editable || null;
  let editing = !!ed?.startEdit, slots = opts.slots;
  const pages = () => Math.max(1, Math.ceil((slots.length + (editing ? 1 : 0)) / PER));
  // a big screen shows the binder open on two pages, like a real one
  const wide = () => innerWidth >= 1000 && !document.documentElement.classList.contains("m");
  const step = () => (wide() ? 2 : 1);
  document.getElementById("bview")?.remove();
  const el = document.createElement("div");
  el.id = "bview"; el.className = "bview";
  document.body.append(el);
  const prevOverflow = document.body.style.overflow; document.body.style.overflow = "hidden";

  const slotHTML = (s, i) => s
    ? (s.owned
      ? `<button class="bv-slot has" data-i="${i}" aria-label="${esc(s.c.name)}">${imgTag(s.c, "high")}</button>`
      : `<button class="bv-slot miss" data-i="${i}" aria-label="${esc(s.c.name)} (manquante)">${s.c.img ? `<span class="bv-ghost" style="background-image:url('${img(s.c.img, "low")}')"></span>` : ""}<b>${esc(s.label || s.c.n || "")}</b><span>${esc(s.c.name)}</span></button>`)
    : `<div class="bv-slot empty" aria-hidden="true"></div>`;
  const addHTML = `<button class="bv-slot add" data-a="add" aria-label="Ajouter des cartes"><i>+</i><span>Ajouter</span></button>`;
  const pageHTML = p => {
    const out = [];
    for (let k = p * PER; k < p * PER + PER; k++) out.push(k < slots.length ? slotHTML(slots[k], k) : editing && k === slots.length ? addHTML : slotHTML(null));
    return out.join("");
  };

  const draw = (turn = 0) => {
    el.style.setProperty("--bv-bg", color); el.style.setProperty("--bv-ink", ink(color));
    el.classList.toggle("bare", hidden && !editing);
    el.classList.toggle("editing", editing);
    page = Math.min(page, pages() - 1);
    if (wide()) page -= page % 2;
    el.innerHTML = `
      <div class="bv-bar">
        <h2>${esc(opts.title)}</h2>
        ${editing ? `<div class="bv-tools">
          <button class="bv-btn" data-a="arrange" aria-label="Ranger automatiquement" title="Ranger automatiquement">${I.sort}</button>
          <button class="bv-btn" data-a="settings" aria-label="Nom, couleur, affichage" title="Nom, couleur, affichage">${I.gear}</button>
          <button class="bv-done" data-a="done">Terminé</button>
        </div>` : `<div class="bv-tools">
          <button class="bv-btn" data-a="mode" aria-label="${mode === "pages" ? "Défilement continu" : "Pages"}" title="${mode === "pages" ? "Passer en défilement continu" : "Passer en pages"}">${mode === "pages" ? I.scroll : I.pages}</button>
          <button class="bv-btn" data-a="color" aria-label="Couleur du fond">${I.color}</button>
          ${opts.onEdit || ed ? `<button class="bv-btn" data-a="edit" aria-label="Modifier le classeur">${I.edit}</button>` : ""}
        </div>`}
      </div>
      ${editing ? `<div class="bv-arr" hidden>${ARRANGE.map(([k, t]) => `<button class="bv-chip" data-k="${k}">${t}</button>`).join("")}</div>
        <p class="bv-hint">Maintiens une carte et lâche-la sur une autre pour les échanger.</p>` : ""}
      <div class="bv-colors" hidden>${BINDER_COLORS.map(c => `<button class="bv-sw ${c === color ? "on" : ""}" data-c="${c}" style="background:${c}" aria-label="Couleur ${c}"></button>`).join("")}</div>
      ${mode === "pages"
        ? `<div class="bv-pagewrap ${wide() ? "spread" : ""}">${(wide() ? [page, page + 1] : [page]).map(p => `<div class="bv-page ${turn > 0 ? "turn-n" : turn < 0 ? "turn-p" : ""}">${pageHTML(p)}</div>`).join("")}</div>
           <div class="bv-pager"><button class="bv-btn" data-a="prev" ${page === 0 ? "disabled" : ""} aria-label="Page précédente">${I.prev}</button><span>${wide() && page + 1 < pages() ? `${page + 1}-${page + 2}` : page + 1} / ${pages()}</span><button class="bv-btn" data-a="next" ${page + step() >= pages() ? "disabled" : ""} aria-label="Page suivante">${I.next}</button></div>`
        : `<div class="bv-scroll"><div class="bv-grid">${slots.map(slotHTML).join("")}${editing ? addHTML : ""}</div></div>`}
      ${editing ? "" : `<button class="bv-hide" data-a="hide">${hidden ? "Afficher" : `${I.hide} Masquer`}</button>
      <button class="bv-close" data-a="close" aria-label="Fermer">${ICON.x}</button>`}`;
  };
  const go = d => { const np = page + d * step(); if (np < 0 || np >= pages()) return; page = np; draw(d); };
  const close = () => {
    el.remove(); document.body.style.overflow = prevOverflow; removeEventListener("keydown", key);
    offs.forEach(f => f()); opts.onClose?.();
  };
  const offs = [];
  const key = e => { if (document.getElementById("cardviewer") || document.querySelector("#modal-root .modal, #modal-root .cpage")) return; if (e.key === "Escape") { if (editing) { editing = false; draw(); } else close(); } if (e.key === "ArrowRight") go(1); if (e.key === "ArrowLeft") go(-1); };
  addEventListener("keydown", key);

  el.addEventListener("click", e => {
    if (justDragged) return;
    const a = e.target.closest("[data-a]")?.dataset.a;
    if (a === "close") return close();
    if (a === "done") { editing = false; return draw(); }
    if (a === "add") { close(); return ed.onAdd(); }
    if (a === "settings") { close(); return ed.onSettings(); }
    if (a === "arrange") { const p = el.querySelector(".bv-arr"); p.hidden = !p.hidden; return; }
    const ak = e.target.closest("[data-k]")?.dataset.k;
    if (ak) { slots = ed.arrange(ak); draw(); el.querySelector(".bv-arr").hidden = false; return; }
    if (a === "prev") return go(-1);
    if (a === "next") return go(1);
    if (a === "hide") { hidden = !hidden; return draw(); }
    if (a === "mode") { mode = mode === "pages" ? "scroll" : "pages"; opts.save?.({ color, mode }); return draw(); }
    if (a === "color") { const p = el.querySelector(".bv-colors"); p.hidden = !p.hidden; return; }
    if (a === "edit") { if (ed) { editing = true; hidden = false; return draw(); } close(); return opts.onEdit(); }
    const sw = e.target.closest("[data-c]");
    if (sw) { color = sw.dataset.c; opts.save?.({ color, mode }); draw(); el.querySelector(".bv-colors").hidden = false; return; }
    const s = e.target.closest("[data-i]");
    if (s && editing) return;
    if (s) {
      const slot = slots[+s.dataset.i];
      if (opts.onOpen) opts.onOpen(slot, slots); else if (slot.c.img) openViewer(slot.c);
      return;
    }
    // with the buttons hidden, a tap on the background brings them back
    if (hidden && !e.target.closest(".bv-slot")) { hidden = false; draw(); }
  });
  // swipe to turn the page
  let sx = null, sy = 0;
  el.addEventListener("touchstart", e => { if (mode !== "pages" || e.touches.length !== 1) { sx = null; return; } sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
  el.addEventListener("touchend", e => { if (sx == null || drag || justDragged) { sx = null; return; } const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy; sx = null; if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.4) go(dx < 0 ? 1 : -1); }, { passive: true });

  /* ---- editing: hold a card, drop it on another one → they swap places ---- */
  let drag = null, p0 = null, timer = 0, flip = 0, justDragged = false;
  const hole = () => el.querySelector(`.bv-slot[data-i="${drag.i}"]`)?.classList.add("bv-hole");
  const start = (i, x, y) => {
    const n = el.querySelector(`.bv-slot[data-i="${i}"]`); if (!n) return;
    const r = n.getBoundingClientRect(), g = n.cloneNode(true);
    g.className = "bv-slot has bv-drag";
    Object.assign(g.style, { width: r.width + "px", height: r.height + "px", left: r.left + "px", top: r.top + "px" });
    document.body.append(g);
    drag = { i, g, dx: x - r.left, dy: y - r.top, over: null, edge: 0, auto: 0 };
    hole(); navigator.vibrate?.(15);
  };
  const target = j => {
    if (drag.over === j) return;
    el.querySelector(".bv-target")?.classList.remove("bv-target");
    drag.over = j;
    if (j != null) el.querySelector(`.bv-slot[data-i="${j}"]`)?.classList.add("bv-target");
  };
  const move = (x, y) => {
    drag.g.style.left = x - drag.dx + "px"; drag.g.style.top = y - drag.dy + "px";
    const t = document.elementFromPoint(x, y)?.closest(".bv-slot.has[data-i]");
    const j = t && el.contains(t) ? +t.dataset.i : null;
    target(j === drag.i ? null : j);
    if (mode === "pages") {
      // held against the left / right edge: turn the page
      const edge = x < 36 ? -1 : x > innerWidth - 36 ? 1 : 0;
      if (edge !== drag.edge) {
        drag.edge = edge; clearTimeout(flip);
        const turn = () => {
          if (!drag?.edge) return;
          const np = page + drag.edge * step();
          if (np >= 0 && np < pages()) { page = np; drag.over = null; draw(drag.edge); hole(); flip = setTimeout(turn, 750); }
        };
        if (edge) flip = setTimeout(turn, 450);
      }
    } else {
      const r = el.querySelector(".bv-scroll").getBoundingClientRect();
      drag.auto = y < r.top + 70 ? -9 : y > r.bottom - 70 ? 9 : 0;
    }
  };
  const end = () => {
    clearTimeout(timer); clearTimeout(flip); p0 = null;
    if (!drag) return;
    const { i, over, g } = drag;
    g.remove(); drag = null;
    justDragged = true; setTimeout(() => { justDragged = false; }, 60);
    if (over != null) { [slots[i], slots[over]] = [slots[over], slots[i]]; ed.reorder(slots.map(s => s.c.id)); navigator.vibrate?.(10); }
    const sc = el.querySelector(".bv-scroll"), top = sc?.scrollTop;
    draw();
    if (sc) el.querySelector(".bv-scroll").scrollTop = top;
  };
  el.addEventListener("pointerdown", e => {
    if (!editing) return;
    const s = e.target.closest(".bv-slot.has[data-i]"); if (!s) return;
    p0 = { x: e.clientX, y: e.clientY, i: +s.dataset.i };
    if (e.pointerType === "mouse") { e.preventDefault(); return; }
    clearTimeout(timer);
    timer = setTimeout(() => { if (p0) start(p0.i, p0.x, p0.y); }, 280);   // long press on a touch screen
  });
  const onMove = e => {
    if (drag) { move(e.clientX, e.clientY); return; }
    if (!p0) return;
    const d = Math.hypot(e.clientX - p0.x, e.clientY - p0.y);
    if (e.pointerType === "mouse" && d > 4) { start(p0.i, p0.x, p0.y); if (drag) move(e.clientX, e.clientY); }
    else if (e.pointerType !== "mouse" && d > 10) { clearTimeout(timer); p0 = null; }   // a scroll or a swipe
  };
  const onUp = () => end();
  addEventListener("pointermove", onMove); addEventListener("pointerup", onUp); addEventListener("pointercancel", onUp);
  const iv = setInterval(() => { if (drag?.auto) el.querySelector(".bv-scroll").scrollTop += drag.auto; }, 16);
  offs.push(() => { removeEventListener("pointermove", onMove); removeEventListener("pointerup", onUp); removeEventListener("pointercancel", onUp); clearInterval(iv); clearTimeout(timer); clearTimeout(flip); drag?.g.remove(); });
  el.addEventListener("touchmove", e => { if (drag) e.preventDefault(); }, { passive: false });
  el.addEventListener("contextmenu", e => { if (editing) e.preventDefault(); });

  // the window gets wider or narrower: one page or two
  let wasWide = wide();
  const onResize = () => { if (wide() !== wasWide && !drag) { wasWide = wide(); draw(); } };
  addEventListener("resize", onResize); offs.push(() => removeEventListener("resize", onResize));
  draw();
  return close;
}

/* the look of a set's binder (colour, pages or scroll) is shared by every extension */
export const setBinderPrefs = () => LS.get("pc-binderview", { color: BINDER_COLORS[2], mode: "pages" });
export const saveSetBinderPrefs = p => LS.set("pc-binderview", p);
