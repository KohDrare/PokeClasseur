import { openViewer } from "./viewer.js";
import { rarity, symHTML } from "../features/rarity.js";
import { badgeHTML, eur, foilOf, fxHTML, isSpecial, mainVariant, priceOf, rareName, variantLabel, variantsOf } from "../features/variants.js";
import { $, ICON, esc } from "../lib/core.js";
import { fmtDate, imgTag, numLabel, toast } from "../lib/ui.js";
import { codeBadge, logoImg } from "../data/tcgdex.js";
import { askMotion, attachTilt } from "../features/tilt.js";
import { renderCollection } from "../pages/collection.js";
import { renderSetStats } from "../pages/set-stats.js";
import { drawCards, refreshCounts } from "../pages/set.js";
import { LANGS, condFactor, isFav, langOf, ownedAny, qtyOf, setFav, setLang, setQty } from "../state/collection.js";
import { S } from "../state/shared.js";
import { unToggleWish } from "../union/feed.js";
import { regionOf, sprite } from "../pages/pokedex.js";
import { openPricePage } from "../features/pricepage.js";
import { UN } from "../union/store.js";

/* ================= CARD MODAL ================= */
export function openCard(card, seq, startV) {
  askMotion();   // iPhone: the 3D card follows the phone (permission asked during this tap)
  const root = $("#modal-root");
  let idx = seq.findIndex(c => c.id === card.id);
  let pv = startV || null; /* version shown on the big card */
  const baseInfo = S.CUR?.data?.info || card._info || {};
  let untilt = () => {};
  const draw = () => {
    untilt(); untilt = () => {};
    if (document.documentElement.classList.contains("m")) return drawPhone();
    const c = seq[idx];
    const info = c._info || baseInfo;   // a list can mix extensions (collection sorted by price…)
    const r = rarity(c.r);
    if (!pv || !variantsOf(c).includes(pv)) pv = mainVariant(c);
    root.innerHTML = `<div class="modal" id="mdl"><div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(c.name)}">
      <button class="iconbtn close" id="m-close" aria-label="Fermer">${ICON.x}</button>
      <div class="big"><div class="holo" id="holo">${imgTag(c, "high")}${fxHTML(foilOf(c, pv))}${badgeHTML(c, pv)}<div class="glare"></div></div></div>
      <div class="info">
        <h2>${esc(c.name)}</h2>
        <div class="line"><span>${esc(numLabel(c, info))}</span>·<span>${esc(c.linked ? info.promoSet || "Promo" : info.name || c._setName || "")}</span></div>
        <dl class="facts">
          <dt>Rareté</dt><dd>${c.ok ? `${symHTML(c.r)} ${esc(isSpecial(c) ? rareName(c) : r.label)}` : "…"}</dd>
          ${c.prod ? `<dt>Obtenue avec</dt><dd>${esc(c.prod)}</dd>` : ""}
                    ${c.cat ? `<dt>Catégorie</dt><dd>${esc(c.cat)}${c.st ? " · " + esc(c.st) : ""}</dd>` : ""}
          ${c.hp ? `<dt>PV</dt><dd>${esc(c.hp)}${c.t ? " · " + esc(c.t) : ""}</dd>` : ""}
          ${c.il ? `<dt>Illustrateur</dt><dd>${esc(c.il)}</dd>` : ""}
          ${c.rm ? `<dt>Marque</dt><dd>${esc(c.rm)}</dd>` : ""}
        </dl>
        <div class="h3">Ma collection</div>
        <div class="versions" id="vers">${variantsOf(c).map(v => verRow(c, v, v === pv)).join("")}</div>
          ${ownedAny(c.id) ? `<div class="langrow" id="m-lang"><span>Langue</span>${Object.entries(LANGS).map(([k, x]) => `<button class="${langOf(c.id) === k ? "on" : ""}" data-l="${k}" aria-pressed="${langOf(c.id) === k}">${x.flag} ${k}</button>`).join("")}</div>` : ""}
        ${variantsOf(c).length > 1 ? `<p class="note" style="margin-top:8px">Clique sur une version pour la voir sur la carte.</p>` : ""}
        <div class="navrow">
          <button class="pill ghost" id="m-prev" ${idx === 0 ? "disabled" : ""}>${ICON.prev}</button>
          <button class="pill ghost" id="m-next" ${idx >= seq.length - 1 ? "disabled" : ""}>${ICON.next}</button>
          <button class="pill ghost" id="m-price"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M17.5 6.5A7 7 0 1 0 17.5 17.5"/><path d="M4 10.5h9M4 13.5h9"/></svg> Prix</button>
          ${c.dx?.length ? `<button class="pill ghost" id="m-dex">Pokédex</button>` : ""}
          <button class="pill ghost" id="m-wish">${UN.wish.some(w => w.id === c.id) ? "Dans ma liste" : "Je la cherche"}</button>
          ${ownedAny(c.id) ? `<button class="pill ghost ${isFav(c.id) ? "on" : ""}" id="m-fav">${isFav(c.id) ? "★ Favorite" : "☆ Favori"}</button>` : ""}
        </div>
        <p class="note" style="margin-top:14px">Prix : tendance Cardmarket. Utilise ← et → pour passer d'une carte à l'autre.</p>
      </div></div></div>`;
    $("#m-close").onclick = close;
    $("#mdl").onclick = e => { if (e.target.id === "mdl") close(); };
    const cref = () => ({ id: c.id, name: c.name, img: c.img, set: info.name || "", n: c.n, r: c.r, p: priceOf(c, pv) || c.p || 0, dx: c.dx || [] });
    $("#m-wish").onclick = () => { unToggleWish(cref()); $("#m-wish").textContent = UN.wish.some(w => w.id === c.id) ? "Dans ma liste" : "Je la cherche"; };
    $("#m-price").onclick = () => openPricePage(c, info, pv, () => { changed = true; });
    $("#m-prev").onclick = () => { if (idx > 0) { idx--; draw(); } };
    $("#m-next").onclick = () => { if (idx < seq.length - 1) { idx++; draw(); } };
    const dxb = $("#m-dex"); if (dxb) dxb.onclick = () => goDex(c.dx[0]);
    const fv = $("#m-fav"); if (fv) fv.onclick = () => { setFav(c.id, !isFav(c.id)); changed = true; fv.classList.toggle("on", isFav(c.id)); fv.textContent = isFav(c.id) ? "★ Favorite" : "☆ Favori"; };
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
    h.onclick = () => openViewer(c);   // tap the card to see it full screen
    if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {
      h.onpointermove = e => { const b = h.getBoundingClientRect(); const x = (e.clientX - b.left) / b.width, y = (e.clientY - b.top) / b.height; h.style.transform = `rotateY(${(x - .5) * 16}deg) rotateX(${(.5 - y) * 16}deg)`; h.style.setProperty("--gx", x * 100 + "%"); h.style.setProperty("--gy", y * 100 + "%"); };
      h.onpointerleave = () => { h.style.transform = ""; h.classList.remove("touching"); };
      h.onpointerdown = () => h.classList.add("touching");
      h.onpointerup = () => h.classList.remove("touching");
    }
  };

  /* ---- phone: the card at the top, a sheet below it that slides up (the card shrinks), like TCG Pocket ---- */
  const drawPhone = () => {
    const c = seq[idx];
    const r = rarity(c.r);
    if (!pv || !variantsOf(c).includes(pv)) pv = mainVariant(c);
    const nInfo = c._info || baseInfo;
    const owned = Object.values(S.COL.cards[c.id]?.v || {}).reduce((a, b) => a + b, 0);
    const wished = UN.wish.some(w => w.id === c.id);
    const pool = (S.CUR?.data?.cards?.some(x => x.id === c.id) ? S.CUR.data.cards : seq).filter(x => !x.grp);
    const base = s => (s || "").toLowerCase().replace(/[-\s]?(ex|gx|v|vmax|vstar|v-union)$/i, "").trim();
    const related = pool.filter(x => x.id !== c.id && (base(x.name) === base(c.name) || (c.dx?.length && x.dx?.some(d => c.dx.includes(d))))).slice(0, 12);
    const rarLabel = c.ok ? (isSpecial(c) ? rareName(c) : r.label) : "…";
    const row = (k, v) => v ? `<div class="cp-row"><dt>${k}</dt><dd>${v}</dd></div>` : "";
    const prices = variantsOf(c).map(v => priceOf(c, v) ? `${esc(variantLabel(c, v))} : ${eur(priceOf(c, v))}` : "").filter(Boolean).join("<br>");
    root.innerHTML = `<div class="cpage" id="mdl" role="dialog" aria-modal="true" aria-label="${esc(c.name)}">
      <div class="cp-top" id="cp-top">
        <div class="cp-bar">
          <span class="cp-own ${owned ? "have" : ""}" title="Exemplaires possédés">${ICON.cards}<b>${owned}</b></span>
          <span class="cp-pos">${idx + 1} / ${seq.length}</span>
          ${owned ? `<button class="cp-ico ${isFav(c.id) ? "on fav" : ""}" id="m-fav" aria-pressed="${isFav(c.id)}" aria-label="Favori"><svg viewBox="0 0 24 24" fill="${isFav(c.id) ? "currentColor" : "none"}" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/></svg><small>Favori</small></button>` : ""}
          <button class="cp-ico ${wished ? "on" : ""}" id="m-wish" aria-pressed="${wished}" aria-label="Je la cherche"><svg viewBox="0 0 24 24" fill="${wished ? "currentColor" : "none"}" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg><small>${wished ? "Recherchée" : "Je la cherche"}</small></button>
        </div>
        <div class="cp-stage" id="cp-stage"><div class="cp-card" id="cp-card">${imgTag(c, "high")}${fxHTML(foilOf(c, pv))}${badgeHTML(c, pv)}<span class="vw-glare"></span></div></div>
      </div>
      <div class="cp-scroll" id="cp-scroll"><div class="cp-sheet" id="cp-sheet">
        <div class="cp-head">
          <div class="cp-acts"><button class="pill cp-price" id="m-price"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M17.5 6.5A7 7 0 1 0 17.5 17.5"/><path d="M4 10.5h9M4 13.5h9"/></svg> Prix${priceOf(c, pv) ? ` · ${eur(priceOf(c, pv) * condFactor(c.id))}` : ""}</button></div>
        </div>
        <h2 class="cp-name">${esc(c.name)}</h2>
        <div class="cp-rar">${c.ok ? symHTML(c.r) : ""}<span>${esc(rarLabel)}</span></div>
        ${c.cat || c.hp || c.dx?.length ? `<div class="cp-box">${[c.dx?.length ? `N° ${String(c.dx[0]).padStart(4, "0")}` : "", c.cat ? esc(c.cat) + (c.st ? " " + esc(c.st) : "") : "", c.hp ? `PV ${esc(c.hp)}` : "", c.t ? esc(c.t) : ""].filter(Boolean).join(" · ")}</div>` : ""}
        <div class="cp-set">
          <div class="cp-logo">${nInfo.id ? logoImg(nInfo.id, nInfo.logo, nInfo.name, nInfo.serie?.id, true) : esc(nInfo.name || "")}</div>
          <div class="cp-num">${nInfo.id ? `<span class="cp-code">${codeBadge(nInfo.id, nInfo.abbr)}</span>` : ""}<b>${esc(numLabel(c, nInfo))}</b></div>
        </div>
        <div class="h3">Ma collection</div>
        <div class="versions" id="vers">${variantsOf(c).map(v => verRow(c, v, v === pv)).join("")}</div>
        ${ownedAny(c.id) ? `<div class="langrow" id="m-lang"><span>Langue</span>${Object.entries(LANGS).map(([k, x]) => `<button class="${langOf(c.id) === k ? "on" : ""}" data-l="${k}" aria-pressed="${langOf(c.id) === k}">${x.flag} ${k}</button>`).join("")}</div>` : ""}
        <dl class="cp-rows">
          ${row("Extension", esc(c.linked ? nInfo.promoSet || "Promo" : nInfo.name || c._setName || ""))}
          ${row("Série", esc(nInfo.serie?.name || ""))}
          ${row("Sortie", nInfo.date ? esc(fmtDate(nInfo.date)) : "")}
          ${row("Rareté", c.ok ? `${symHTML(c.r)} ${esc(c.r || r.label)}` : "")}
          ${row("Obtenue avec", esc(c.prod || ""))}
          ${row("Illustration", esc(c.il || ""))}
          ${row("Marque", c.rm ? `<span class="cp-rm">${esc(c.rm)}</span>` : "")}
          ${row("Prix", prices)}
        </dl>
        ${c.dx?.length ? `<button class="cp-dexbtn" id="m-dex"><img src="${sprite(c.dx[0])}" alt="" loading="lazy" onerror="this.remove()"><span>Voir dans le Pokédex<small>N° ${String(c.dx[0]).padStart(4, "0")}</small></span>${ICON.next}</button>` : ""}
        ${related.length ? `<div class="cp-hd">Cartes connexes</div><div class="cp-rel">${related.map(x => `<button class="cp-relc ${ownedAny(x.id) ? "" : "miss"}" data-rel="${esc(x.id)}" aria-label="${esc(x.name)}">${imgTag(x, "low")}</button>`).join("")}</div>` : ""}
        <p class="note cp-tip">Glisse la carte à gauche ou à droite pour passer à la suivante.</p>
      </div></div>
      <button id="m-prev" hidden ${idx === 0 ? "disabled" : ""}></button><button id="m-next" hidden ${idx >= seq.length - 1 ? "disabled" : ""}></button>
      <button class="cp-close" id="m-close" aria-label="Fermer">${ICON.x}</button>
    </div>`;
    const top = $("#cp-top"), stage = $("#cp-stage"), card = $("#cp-card"), sc = $("#cp-scroll"), sheet = $("#cp-sheet");
    // sizes: full card, then it shrinks to a third while the sheet comes up
    const BAR = 58 + (parseFloat(getComputedStyle(top).paddingTop) || 0);
    const H0 = Math.min(innerHeight * 0.56, (innerWidth - 80) * 88 / 63), HMIN = Math.round(H0 * 0.36), GAP = 18;
    card.style.height = H0 + "px";
    sheet.style.marginTop = BAR + H0 + GAP + "px";   // a margin, not padding: sticky positions count from the padding edge
    sheet.style.minHeight = innerHeight - BAR - HMIN - GAP + "px";
    root.querySelector(".cpage").style.setProperty("--pin", BAR + HMIN + GAP + "px");
    const fit = () => {
      const h = Math.max(HMIN, H0 - sc.scrollTop);
      stage.style.transform = `scale(${(h / H0).toFixed(4)})`;
      top.style.height = BAR + h + GAP + "px";
    };
    sc.addEventListener("scroll", () => requestAnimationFrame(fit), { passive: true });
    fit();
    untilt = attachTilt(card);
    card.onclick = () => openViewer(c, null, pv);
    $("#m-close").onclick = close;
    $("#m-prev").onclick = () => { if (idx > 0) { idx--; draw(); } };
    $("#m-next").onclick = () => { if (idx < seq.length - 1) { idx++; draw(); } };
    const cref = () => ({ id: c.id, name: c.name, img: c.img, set: nInfo.name || "", n: c.n, r: c.r, p: priceOf(c, pv) || c.p || 0, dx: c.dx || [] });
    $("#m-wish").onclick = () => { unToggleWish(cref()); const y = sc.scrollTop; draw(); $("#cp-scroll").scrollTop = y; };
    const dxb = $("#m-dex"); if (dxb) dxb.onclick = () => goDex(c.dx[0]);
    const fv = $("#m-fav"); if (fv) fv.onclick = () => { setFav(c.id, !isFav(c.id)); changed = true; const y = sc.scrollTop; draw(); $("#cp-scroll").scrollTop = y; };
    $("#m-price").onclick = () => openPricePage(c, nInfo, pv, () => { changed = true; const b = $("#m-price"); if (b && priceOf(c, pv)) b.lastChild.textContent = ` Prix · ${eur(priceOf(c, pv) * condFactor(c.id))}`; });
    const showFoil = () => {
      card.querySelector(".fx")?.remove(); card.querySelector(".ftag")?.remove();
      card.querySelector(".vw-glare").insertAdjacentHTML("beforebegin", fxHTML(foilOf(c, pv)) + badgeHTML(c, pv));
      document.querySelectorAll("#vers .ver").forEach(x => x.classList.toggle("on", x.dataset.v === pv));
    };
    $("#vers").onclick = e => {
      const b = e.target.closest("[data-d]");
      if (b) {
        const v = b.dataset.v; setQty(c, v, qtyOf(c.id, v) + (+b.dataset.d));
        b.closest(".ver").outerHTML = verRow(c, v, v === pv);
        changed = true;
        const n = Object.values(S.COL.cards[c.id]?.v || {}).reduce((a, x) => a + x, 0);
        const o = root.querySelector(".cp-own"); o.classList.toggle("have", !!n); o.querySelector("b").textContent = n;
        if (v !== pv) { pv = v; showFoil(); }
        return;
      }
      const rw = e.target.closest(".ver"); if (!rw || rw.dataset.v === pv) return;
      pv = rw.dataset.v; showFoil();
    };
    bindLang(() => { const y = sc.scrollTop; draw(); $("#cp-scroll").scrollTop = y; });
    root.querySelector(".cp-rel")?.addEventListener("click", e => {
      const b = e.target.closest("[data-rel]"); if (!b) return;
      const j = seq.findIndex(x => x.id === b.dataset.rel);
      if (j >= 0) { idx = j; pv = null; draw(); }
      else { const x = pool.find(y => y.id === b.dataset.rel); if (x) { seq = [c, ...related]; idx = seq.indexOf(x); pv = null; draw(); } }
    });
  };
  /* open this Pokémon in the Pokédex */
  const goDex = n => { close(); location.hash = `#/pokedex/${regionOf(n)?.id || "national"}/${n}`; };
  /* language buttons of the copy you own */
  const bindLang = redraw => { const r = $("#m-lang"); if (r) r.onclick = e => { const b = e.target.closest("[data-l]"); if (!b) return; setLang(seq[idx].id, b.dataset.l); changed = true; redraw(); }; };
  let changed = false;
  const key = e => { if (e.key === "Escape") close(); if (e.key === "ArrowRight" && idx < seq.length - 1) { idx++; draw(); } if (e.key === "ArrowLeft" && idx > 0) { idx--; draw(); } };
  function close() { untilt(); root.innerHTML = ""; document.removeEventListener("keydown", key); document.body.style.overflow = ""; if (changed) { if (location.hash.startsWith("#/stats/")) { const y = scrollY; renderSetStats(decodeURIComponent(location.hash.slice(8))).then(() => scrollTo(0, y)); } else if ($("#cards") && S.CUR) { const y = scrollY; drawCards(); refreshCounts(); scrollTo(0, y); } else if (location.hash.startsWith("#/collection")) renderCollection(); } }
  document.addEventListener("keydown", key);
  document.body.style.overflow = "hidden";
  draw();
}
export function verRow(c, v, on) {
  const q = qtyOf(c.id, v), p = priceOf(c, v);
  return `<div class="ver ${q ? "have" : ""} ${on ? "on" : ""}" data-v="${v}"><div><div class="vn">${esc(variantLabel(c, v))}</div><div class="vp">${p ? eur(p) + " pièce" : "prix inconnu"}</div></div>
    <div class="step"><button data-v="${v}" data-d="-1" aria-label="Retirer un exemplaire">−</button><b>${q}</b><button data-v="${v}" data-d="1" aria-label="Ajouter un exemplaire">+</button></div></div>`;
}
