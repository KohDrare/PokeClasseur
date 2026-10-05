import { rarity, symHTML } from "../features/rarity.js";
import { badgeHTML, eur, foilOf, fxHTML, isSpecial, mainVariant, priceOf, rareName, variantLabel, variantsOf } from "../features/variants.js";
import { $, ICON, esc } from "../lib/core.js";
import { imgTag, numLabel, toast } from "../lib/ui.js";
import { renderCollection } from "../pages/collection.js";
import { renderSetStats } from "../pages/set-stats.js";
import { drawCards, refreshCounts } from "../pages/set.js";
import { ownedAny, qtyOf, setQty } from "../state/collection.js";
import { S } from "../state/shared.js";
import { unToggleWish } from "../union/feed.js";
import { unListingForm } from "../union/market.js";
import { UN } from "../union/store.js";

/* ================= CARD MODAL ================= */
export function openCard(card, seq, startV) {
  const root = $("#modal-root");
  let idx = seq.findIndex(c => c.id === card.id);
  let pv = startV || null; /* version shown on the big card */
  const info = S.CUR?.data?.info || card._info || {};
  const draw = () => {
    const c = seq[idx];
    const r = rarity(c.r);
    if (!pv || !variantsOf(c).includes(pv)) pv = mainVariant(c);
    root.innerHTML = `<div class="modal" id="mdl"><div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(c.name)}">
      <button class="iconbtn close" id="m-close" aria-label="Fermer">${ICON.x}</button>
      <div class="big"><div class="holo" id="holo">${imgTag(c, "high")}${fxHTML(foilOf(c, pv))}${badgeHTML(c, pv)}<div class="glare"></div></div></div>
      <div class="info">
        <h2>${esc(c.name)}</h2>
        <div class="line"><span>${esc(numLabel(c, info))}</span>·<span>${esc(info.name || c._setName || "")}</span></div>
        <dl class="facts">
          <dt>Rareté</dt><dd>${c.ok ? `${symHTML(c.r)} ${esc(isSpecial(c) ? rareName(c) : r.label)}` : "…"}</dd>
          ${c.cat ? `<dt>Catégorie</dt><dd>${esc(c.cat)}${c.st ? " · " + esc(c.st) : ""}</dd>` : ""}
          ${c.hp ? `<dt>PV</dt><dd>${esc(c.hp)}${c.t ? " · " + esc(c.t) : ""}</dd>` : ""}
          ${c.il ? `<dt>Illustrateur</dt><dd>${esc(c.il)}</dd>` : ""}
          ${c.rm ? `<dt>Marque</dt><dd>${esc(c.rm)}</dd>` : ""}
        </dl>
        <div class="h3">Ma collection</div>
        <div class="versions" id="vers">${variantsOf(c).map(v => verRow(c, v, v === pv)).join("")}</div>
        ${variantsOf(c).length > 1 ? `<p class="note" style="margin-top:8px">Clique sur une version pour la voir sur la carte.</p>` : ""}
        <div class="navrow">
          <button class="pill ghost" id="m-prev" ${idx === 0 ? "disabled" : ""}>${ICON.prev}</button>
          <button class="pill ghost" id="m-next" ${idx >= seq.length - 1 ? "disabled" : ""}>${ICON.next}</button>
          <a class="pill ghost" href="https://www.cardmarket.com/fr/Pokemon/Products/Search?searchString=${encodeURIComponent(c.name)}" target="_blank" rel="noopener">Cardmarket</a>
          <button class="pill ghost" id="m-wish">${UN.wish.some(w => w.id === c.id) ? "Dans ma liste" : "Je la cherche"}</button>
          ${ownedAny(c.id) ? `<button class="pill ghost" id="m-sell">Vendre</button>` : ""}
        </div>
        <p class="note" style="margin-top:14px">Prix : tendance Cardmarket (TCGdex). Utilise ← et → pour passer d'une carte à l'autre.</p>
      </div></div></div>`;
    $("#m-close").onclick = close;
    $("#mdl").onclick = e => { if (e.target.id === "mdl") close(); };
    const cref = () => ({ id: c.id, name: c.name, img: c.img, set: info.name || "", n: c.n, r: c.r, p: priceOf(c, pv) || c.p || 0, dx: c.dx || [] });
    $("#m-wish").onclick = () => { unToggleWish(cref()); $("#m-wish").textContent = UN.wish.some(w => w.id === c.id) ? "Dans ma liste" : "Je la cherche"; };
    const sb = $("#m-sell"); if (sb) sb.onclick = () => { if (!UN.me.name) { close(); toast("Crée d'abord ton profil Union Room"); location.hash = "#/union/profile"; return; } const r = cref(); close(); unListingForm(r); };
    $("#m-prev").onclick = () => { if (idx > 0) { idx--; draw(); } };
    $("#m-next").onclick = () => { if (idx < seq.length - 1) { idx++; draw(); } };
    const showFoil = () => {
      const h2 = $("#holo"); h2.querySelector(".fx")?.remove(); h2.querySelector(".ftag")?.remove();
      h2.querySelector(".glare").insertAdjacentHTML("beforebegin", fxHTML(foilOf(c, pv)) + badgeHTML(c, pv));
      document.querySelectorAll("#vers .ver").forEach(x => x.classList.toggle("on", x.dataset.v === pv));
    };
    $("#vers").onclick = e => {
      const b = e.target.closest("[data-d]");
      if (b) {
        const v = b.dataset.v; setQty(c, v, qtyOf(c.id, v) + (+b.dataset.d));
        b.closest(".ver").outerHTML = verRow(c, v, v === pv);
        changed = true;
        if (v !== pv) { pv = v; showFoil(); }
        return;
      }
      const row = e.target.closest(".ver"); if (!row || row.dataset.v === pv) return;
      pv = row.dataset.v; showFoil();
    };
    const h = $("#holo");
    if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {
      h.onpointermove = e => { const b = h.getBoundingClientRect(); const x = (e.clientX - b.left) / b.width, y = (e.clientY - b.top) / b.height; h.style.transform = `rotateY(${(x - .5) * 16}deg) rotateX(${(.5 - y) * 16}deg)`; h.style.setProperty("--gx", x * 100 + "%"); h.style.setProperty("--gy", y * 100 + "%"); };
      h.onpointerleave = () => { h.style.transform = ""; h.classList.remove("touching"); };
      h.onpointerdown = () => h.classList.add("touching");
      h.onpointerup = () => h.classList.remove("touching");
    }
  };
  let changed = false;
  const key = e => { if (e.key === "Escape") close(); if (e.key === "ArrowRight" && idx < seq.length - 1) { idx++; draw(); } if (e.key === "ArrowLeft" && idx > 0) { idx--; draw(); } };
  function close() { root.innerHTML = ""; document.removeEventListener("keydown", key); document.body.style.overflow = ""; if (changed) { if (location.hash.startsWith("#/stats/")) { const y = scrollY; renderSetStats(decodeURIComponent(location.hash.slice(8))).then(() => scrollTo(0, y)); } else if ($("#cards") && S.CUR) { const y = scrollY; drawCards(); refreshCounts(); scrollTo(0, y); } else if (location.hash.startsWith("#/collection")) renderCollection(); } }
  document.addEventListener("keydown", key);
  document.body.style.overflow = "hidden";
  draw();
}
export function verRow(c, v, on) {
  const q = qtyOf(c.id, v), p = priceOf(c, v);
  return `<div class="ver ${q ? "have" : ""} ${on ? "on" : ""}" data-v="${v}"><div><div class="vn">${esc(variantLabel(c, v))}</div><div class="vp">${p ? eur(p) + " pièce" : "prix inconnu"}</div></div>
    <div class="step"><button data-v="${v}" data-d="-1" aria-label="Retirer un exemplaire">−</button><b>${q}</b><button data-v="${v}" data-d="1" aria-label="Ajouter un exemplaire">+</button></div></div>`;
}
