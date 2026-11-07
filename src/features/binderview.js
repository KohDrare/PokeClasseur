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
  prev: ICON.prev, next: ICON.next
};
/* light or dark text on the chosen colour */
const ink = hex => { const n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255; return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? "#16192b" : "#ffffff"; };

/* opts: { title, slots:[{ c, owned, label }], color, mode: "pages"|"scroll", save(prefs), onEdit, onOpen(c, slots) } */
export function openBinderView(opts) {
  let { color, mode } = opts, page = 0, hidden = false;
  const slots = opts.slots;
  const pages = Math.max(1, Math.ceil(slots.length / PER));
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
  const pageHTML = p => { const a = slots.slice(p * PER, p * PER + PER); while (a.length < PER) a.push(null); return a.map((s, j) => slotHTML(s, p * PER + j)).join(""); };

  const draw = (turn = 0) => {
    el.style.setProperty("--bv-bg", color); el.style.setProperty("--bv-ink", ink(color));
    el.classList.toggle("bare", hidden);
    el.innerHTML = `
      <div class="bv-bar">
        <h2>${esc(opts.title)}</h2>
        <div class="bv-tools">
          <button class="bv-btn" data-a="mode" aria-label="${mode === "pages" ? "Défilement continu" : "Pages"}" title="${mode === "pages" ? "Passer en défilement continu" : "Passer en pages"}">${mode === "pages" ? I.scroll : I.pages}</button>
          <button class="bv-btn" data-a="color" aria-label="Couleur du fond">${I.color}</button>
          ${opts.onEdit ? `<button class="bv-btn" data-a="edit" aria-label="Modifier le classeur">${I.edit}</button>` : ""}
        </div>
      </div>
      <div class="bv-colors" hidden>${BINDER_COLORS.map(c => `<button class="bv-sw ${c === color ? "on" : ""}" data-c="${c}" style="background:${c}" aria-label="Couleur ${c}"></button>`).join("")}</div>
      ${mode === "pages"
        ? `<div class="bv-pagewrap"><div class="bv-page ${turn > 0 ? "turn-n" : turn < 0 ? "turn-p" : ""}">${pageHTML(page)}</div></div>
           <div class="bv-pager"><button class="bv-btn" data-a="prev" ${page === 0 ? "disabled" : ""} aria-label="Page précédente">${I.prev}</button><span>${page + 1} / ${pages}</span><button class="bv-btn" data-a="next" ${page >= pages - 1 ? "disabled" : ""} aria-label="Page suivante">${I.next}</button></div>`
        : `<div class="bv-scroll"><div class="bv-grid">${slots.map(slotHTML).join("")}</div></div>`}
      <button class="bv-hide" data-a="hide">${hidden ? "Afficher" : `${I.hide} Masquer`}</button>
      <button class="bv-close" data-a="close" aria-label="Fermer">${ICON.x}</button>`;
  };
  const go = d => { const np = page + d; if (np < 0 || np >= pages) return; page = np; draw(d); };
  const close = () => { el.remove(); document.body.style.overflow = prevOverflow; removeEventListener("keydown", key); };
  const key = e => { if (document.getElementById("cardviewer") || document.querySelector("#modal-root .modal, #modal-root .cpage")) return; if (e.key === "Escape") close(); if (e.key === "ArrowRight") go(1); if (e.key === "ArrowLeft") go(-1); };
  addEventListener("keydown", key);

  el.addEventListener("click", e => {
    const a = e.target.closest("[data-a]")?.dataset.a;
    if (a === "close") return close();
    if (a === "prev") return go(-1);
    if (a === "next") return go(1);
    if (a === "hide") { hidden = !hidden; return draw(); }
    if (a === "mode") { mode = mode === "pages" ? "scroll" : "pages"; opts.save?.({ color, mode }); return draw(); }
    if (a === "color") { const p = el.querySelector(".bv-colors"); p.hidden = !p.hidden; return; }
    if (a === "edit") { close(); return opts.onEdit(); }
    const sw = e.target.closest("[data-c]");
    if (sw) { color = sw.dataset.c; opts.save?.({ color, mode }); draw(); el.querySelector(".bv-colors").hidden = false; return; }
    const s = e.target.closest("[data-i]");
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
  el.addEventListener("touchend", e => { if (sx == null) return; const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy; sx = null; if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.4) go(dx < 0 ? 1 : -1); }, { passive: true });
  draw();
  return close;
}

/* the look of a set's binder (colour, pages or scroll) is shared by every extension */
export const setBinderPrefs = () => LS.get("pc-binderview", { color: BINDER_COLORS[2], mode: "pages" });
export const saveSetBinderPrefs = p => LS.set("pc-binderview", p);
