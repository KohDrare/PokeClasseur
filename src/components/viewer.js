/* Full-screen card viewer: the card as big as the screen allows, double-tap or 🔍 to zoom, drag to look around. */
import { ICON, esc } from "../lib/core.js";
import { img } from "../data/tcgdex.js";
import { attachTilt, askMotion } from "../features/tilt.js";
import { foilOf, fxHTML } from "../features/variants.js";

const ZOOM = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5M11 8v6M8 11h6"/></svg>';
const UNZOOM = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5M8 11h6"/></svg>';
const INFO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/></svg>';

/* card: { img, name } ; onDetails: optional, shows a button that opens the card sheet */
export function openViewer(card, onDetails, variant) {
  if (!card?.img) return;
  askMotion();   // iPhone: motion permission, asked during this tap
  document.getElementById("cardviewer")?.remove();
  const el = document.createElement("div");
  el.id = "cardviewer"; el.className = "viewer";
  el.setAttribute("role", "dialog"); el.setAttribute("aria-label", card.name || "Carte");
  el.innerHTML = `<div class="vw-bar">
      ${onDetails ? `<button class="vw-btn" id="vw-info" aria-label="Détails de la carte">${INFO}</button>` : ""}
      <button class="vw-btn" id="vw-zoom" aria-label="Zoomer">${ZOOM}</button>
      <button class="vw-btn" id="vw-close" aria-label="Fermer">${ICON.x}</button>
    </div>
    <div class="vw-stage" id="vw-stage"><div class="vw-card" id="vw-card"><img src="${img(card.img, "high")}" alt="${esc(card.name || "")}" draggable="false" onerror="cardImgErr(this)">${card.v ? fxHTML(foilOf(card, variant)) : ""}<span class="vw-glare"></span></div></div>
    <div class="vw-hint">Incline ou touche la carte · double-tap pour zoomer</div>`;
  document.body.appendChild(el);
  const prevOverflow = document.body.style.overflow;
  document.body.style.overflow = "hidden";
  const stage = el.querySelector("#vw-stage"), zb = el.querySelector("#vw-zoom"), cardEl = el.querySelector("#vw-card");
  const untilt = attachTilt(cardEl);
  let zoomed = false;

  const setZoom = (on, x = 0.5, y = 0.5) => {
    zoomed = on;
    stage.classList.toggle("zoomed", on);
    if (on) { cardEl.dataset.notilt = "1"; cardEl.style.transform = ""; } else delete cardEl.dataset.notilt;
    zb.innerHTML = on ? UNZOOM : ZOOM;
    zb.setAttribute("aria-label", on ? "Dézoomer" : "Zoomer");
    if (on) requestAnimationFrame(() => {   // keep the tapped spot under the finger
      stage.scrollLeft = x * stage.scrollWidth - stage.clientWidth / 2;
      stage.scrollTop = y * stage.scrollHeight - stage.clientHeight / 2;
    });
  };
  const close = () => { untilt(); el.remove(); document.body.style.overflow = prevOverflow; removeEventListener("keydown", key); };
  const key = e => { if (e.key === "Escape") close(); };
  addEventListener("keydown", key);

  el.querySelector("#vw-close").onclick = close;
  zb.onclick = () => setZoom(!zoomed);
  const info = el.querySelector("#vw-info");
  if (info) info.onclick = () => { close(); onDetails(); };

  // double-tap (touch) or double-click zooms where you tapped
  let lastTap = 0;
  stage.addEventListener("click", e => {
    const now = Date.now();
    if (now - lastTap < 320) {
      const im = cardEl.getBoundingClientRect();
      setZoom(!zoomed, (e.clientX - im.left) / im.width, (e.clientY - im.top) / im.height);
      lastTap = 0;
    } else {
      lastTap = now;
      // a single tap on the dark background closes, like a photo app
      setTimeout(() => { if (lastTap === now && !zoomed && (e.target === stage || e.target === cardEl.parentElement)) close(); }, 330);
    }
  });
  // drag to move around when zoomed (mouse; touch scrolls natively)
  let drag = null;
  stage.addEventListener("pointerdown", e => { if (zoomed && e.pointerType === "mouse") drag = { x: e.clientX, y: e.clientY, l: stage.scrollLeft, t: stage.scrollTop }; });
  addEventListener("pointerup", () => { drag = null; }, { once: false });
  stage.addEventListener("pointermove", e => { if (drag) { stage.scrollLeft = drag.l - (e.clientX - drag.x); stage.scrollTop = drag.t - (e.clientY - drag.y); } });
}
