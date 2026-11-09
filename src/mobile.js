/* Phone layout (html.m, set by the small script in index.html): bottom tab bar, "more" menu,
   swipe between cards in the card sheet. Nothing here runs on computers. */
import { $ } from "./lib/core.js";
import { openInstall } from "./pwa.js";

const html = document.documentElement;
const setUI = v => { try { localStorage.setItem("pc-ui", v); } catch { /* private mode: only this visit */ } location.reload(); };

// computers and tablets: the footer offers the phone layout back to someone who left it
const back = $("#btn-mobile");
if (back && html.classList.contains("m-able")) { back.hidden = false; back.onclick = () => setUI("m"); }

if (html.classList.contains("m")) {
  /* "more" menu: everything the phone header has no room for */
  const standalone = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  const dark = () => html.dataset.theme === "dark" || (!html.dataset.theme && matchMedia("(prefers-color-scheme: dark)").matches);
  const I = {
    sync: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12a8 8 0 0 1 14-5.3L20 9"/><path d="M20 4v5h-5"/><path d="M20 12a8 8 0 0 1-14 5.3L4 15"/><path d="M4 20v-5h5"/></svg>',
    moon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 13A9 9 0 1 1 11 3a7 7 0 0 0 10 10z"/></svg>',
    sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
    dl: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/></svg>',
    pc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/></svg>',
    info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/></svg>'
  };
  const openMore = () => {
    const root = $("#modal-root");
    const close = () => { root.innerHTML = ""; document.body.style.overflow = ""; removeEventListener("keydown", key); };
    const key = e => { if (e.key === "Escape") close(); };
    addEventListener("keydown", key); document.body.style.overflow = "hidden";
    root.innerHTML = `<div class="modal" id="mdl"><div class="sheet moresheet" role="dialog" aria-modal="true" aria-label="Plus d'options">
      <button class="mrow" data-a="sync">${I.sync}<span>Sauvegarde et synchronisation</span></button>
      <button class="mrow" data-a="theme">${dark() ? I.sun : I.moon}<span>${dark() ? "Passer en mode clair" : "Passer en mode sombre"}</span></button>
      ${standalone() ? "" : `<button class="mrow" data-a="install">${I.dl}<span>Installer l'app sur l'écran d'accueil</span></button>`}
      <button class="mrow" data-a="desktop">${I.pc}<span>Version ordinateur</span></button>
      <details class="mabout"><summary>${I.info}<span>À propos et crédits</span></summary>${[...document.querySelectorAll(".site-foot p")].map(p => `<p>${p.innerHTML}</p>`).join("")}</details>
      <button class="pill ghost mclose" id="m-close">Fermer</button>
    </div></div>`;
    $("#m-close").onclick = close;
    $("#mdl").onclick = e => { if (e.target.id === "mdl") close(); };
    root.querySelectorAll("[data-a]").forEach(b => b.onclick = () => {
      const a = b.dataset.a; close();
      if (a === "sync") $("#btn-sync")?.click();
      else if (a === "theme") $("#btn-theme")?.click();
      else if (a === "install") openInstall();
      else if (a === "desktop") setUI("d");
    });
  };
  $("#btn-more").onclick = openMore;

  /* card sheet: swipe left / right for the next / previous card */
  let t0 = null;
  document.addEventListener("touchstart", e => {
    const sheet = !e.target.closest?.("#modal-stack") && e.target.closest?.("#mdl .sheet, #mdl.cpage .cp-top, #mdl.cpage .cp-stage");
    t0 = sheet && $("#m-next") && e.touches.length === 1 && !e.target.closest("input,textarea,.versions") ? { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() } : null;
  }, { passive: true });
  document.addEventListener("touchend", e => {
    if (!t0) return;
    const dx = e.changedTouches[0].clientX - t0.x, dy = e.changedTouches[0].clientY - t0.y;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.6 && Date.now() - t0.t < 700) {
      const b = $(dx < 0 ? "#m-next" : "#m-prev");
      if (b && !b.disabled) { b.click(); $("#mdl .sheet, #mdl #cp-card")?.classList.add(dx < 0 ? "in-r" : "in-l"); }
    }
    t0 = null;
  }, { passive: true });
}

