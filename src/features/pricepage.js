/* Price page of a card (the "€" button): a fair price that resists one-off sales, the price by condition,
   the Cardmarket details and links to compare (Cardmarket, eBay sold items, Vinted).
   Prices are fetched fresh from TCGdex (Cardmarket in €, TCGplayer in $) when the page opens. */
import { getJSON } from "../data/tcgdex.js";
import { $, API, ICON, esc } from "../lib/core.js";
import { imgTag, numLabel } from "../lib/ui.js";
import { VARIANT_LABEL, eur, priceOf, variantsOf } from "./variants.js";
import { PRICE_DATE, priceCheck } from "../data/price-hints.js";
import { condOf, ownedAny, setCond } from "../state/collection.js";

/* how much a card is worth by condition, as a share of a near-mint copy (usual Cardmarket ratios) */
export const CONDITIONS = [
  { k: "NM", l: "Near Mint", fr: "Comme neuve", f: 1, col: "#1f9d63" },
  { k: "EX", l: "Excellent", fr: "Très bon état", f: 0.85, col: "#5fae2f" },
  { k: "GD", l: "Good", fr: "Bon état", f: 0.7, col: "#c9a21b" },
  { k: "LP", l: "Light Played", fr: "Légèrement jouée", f: 0.55, col: "#e8862a" },
  { k: "PL", l: "Played", fr: "Jouée", f: 0.4, col: "#e05a33" },
  { k: "PO", l: "Poor", fr: "Abîmée", f: 0.25, col: "#c62f3c" }
];
const median = a => { const v = a.filter(x => x > 0).sort((x, y) => x - y); if (!v.length) return 0; const m = v.length >> 1; return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2; };

/* the Cardmarket figures of one version: normal cards use the plain fields, reverse/holo the "-holo" ones */
function figures(cm, v) {
  if (!cm) return null;
  const h = v === "reverse" || (v === "holo" && cm["trend-holo"]) ? "-holo" : "";
  const f = { trend: cm["trend" + h], avg1: cm["avg1" + h], avg7: cm["avg7" + h], avg30: cm["avg30" + h], low: cm["low" + h], avg: cm["avg" + h] };
  if (h && !f.trend && !f.avg7 && !f.avg30) return figures(cm, "normal");   // no foil prices: fall back
  // fair price: middle of the trend and the 7- and 30-day averages (one strange sale cannot move it much)
  f.fair = median([f.trend, f.avg7, f.avg30]) || f.avg || f.trend || 0;
  const pts = [f.avg30, f.avg7, f.avg1].filter(x => x > 0);
  f.lo = pts.length ? Math.min(...pts) : 0; f.hi = pts.length ? Math.max(...pts) : 0;
  return f;
}

export async function openPricePage(c, info, startV, onChange) {
  document.getElementById("pricepage")?.remove();
  const el = document.createElement("div");
  el.id = "pricepage"; el.className = "pricepage";
  el.innerHTML = `<div class="pp-sheet" role="dialog" aria-modal="true" aria-label="Prix de ${esc(c.name)}"><div class="pp-load">Recherche des prix…</div></div>`;
  document.body.append(el);
  const close = () => { el.remove(); removeEventListener("keydown", key, true); };
  const key = e => { if (e.key === "Escape") { e.stopPropagation(); close(); } };
  addEventListener("keydown", key, true);
  el.onclick = e => { if (e.target === el || e.target.closest("#pp-close")) close(); };

  let d = null;
  try { d = await getJSON(`${API}/cards/${encodeURIComponent(c.id)}`); } catch { /* offline */ }
  if (!el.isConnected) return;
  const cm = d?.pricing?.cardmarket, tp = d?.pricing?.tcgplayer;
  const vs = variantsOf(c);
  let v = startV && vs.includes(startV) ? startV : vs[0];
  const q = encodeURIComponent(`${c.name} ${info?.abbr || ""} ${c.n || ""}`.replace(/\s+/g, " ").trim());
  const qShort = encodeURIComponent(`${c.name} ${c.n || ""}`.trim());
  const tpv = tp ? Object.entries(tp).find(([k, x]) => x && typeof x === "object" && (v === "reverse" ? /reverse/i.test(k) : !/reverse/i.test(k)))?.[1] : null;

  const owned = ownedAny(c.id);
  let cond = condOf(c.id);
  const draw = () => {
    let f = figures(cm, v);
    /* the price shown on the card (preview, collection value) is the reference: the same number here.
       Cardmarket's details are kept when they belong to it; far off, they are another version's product */
    const ref = priceOf(c, v), near = (x, y) => x > 0 && y > 0 && x / y < 1.35 && y / x < 1.35;
    if (ref) {
      if (f?.fair && near(f.fair, ref)) f.fair = ref;
      else f = { fair: ref, hint: true, src: "card", cmWrong: f?.fair || 0 };
    } else {
      // Cardmarket figures linked to the wrong product (another version of the card): hand price or TCGplayer instead
      const bad = f?.fair && v !== "reverse" ? priceCheck(c.setId, c.n, f.fair, tp) : null;
      if (bad) f = { fair: bad.p, hint: true, src: bad.src, cmWrong: f.fair };
      else if ((!f || !f.fair) && c.p && v !== "reverse") f = { fair: c.p, hint: true, src: "hint" };
    }
    const fair = f?.fair || 0;
    const row = (l, x, sub = "") => x ? `<div class="pp-row"><span>${l}${sub ? `<small>${sub}</small>` : ""}</span><b>${eur(x)}</b></div>` : "";
    el.querySelector(".pp-sheet").innerHTML = `
      <button class="iconbtn close" id="pp-close" aria-label="Fermer">${ICON.x}</button>
      <div class="pp-head">
        <div class="pp-img">${imgTag(c, "low")}</div>
        <div><h2>${esc(c.name)}</h2><div class="note">${esc(info?.name || "")} · ${esc(numLabel(c, info || {}))}</div>
          ${vs.length > 1 ? `<div class="seg pp-vers">${vs.map(x => `<button data-v="${x}" class="${x === v ? "on" : ""}">${esc(VARIANT_LABEL[x] || x)}</button>`).join("")}</div>` : ""}</div>
      </div>
      ${fair ? `
        <div class="pp-main">
          ${(() => { const k = CONDITIONS.find(x => x.k === (owned ? cond : "NM")); return `
          <div class="pp-lbl">Prix estimé · <span class="pp-st" style="--cc:${k.col}">${k.k} · ${k.fr.toLowerCase()}</span></div>
          <div class="pp-val">${eur(Math.max(0.02, fair * k.f))}</div>
          ${k.k !== "NM" ? `<div class="note">Comme neuve : ${eur(fair)}</div>` : ""}`; })()}
          ${f.lo && f.hi && f.hi - f.lo > 0.01 ? `<div class="note">Fourchette récente (comme neuve) : ${eur(f.lo)} – ${eur(f.hi)}</div>` : ""}
          ${f.cmWrong ? `<div class="note">La base de prix associe cette carte à une autre version sur Cardmarket (${eur(f.cmWrong)}) : ${f.src === "card" ? "le prix de la carte est utilisé à la place, le même que sur sa fiche" : f.src === "tcgplayer" ? "prix TCGplayer converti en euros utilisé à la place" : "prix relevé à la main utilisé à la place"}.</div>` : ""}
          ${f.hint && f.src === "hint" && !f.cmWrong ? `<div class="note">Prix relevé à la main le ${new Date(PRICE_DATE[c.setId] || Date.now()).toLocaleDateString("fr-BE", { day: "numeric", month: "long" })} (ventes Cardmarket) : l'extension est trop récente pour la base de prix.</div>` : ""}
        </div>
        <div class="pp-h">${owned ? "État de ta carte <small>touche pour le changer</small>" : "Selon l'état"}</div>
        <div class="pp-conds">${CONDITIONS.map(k => `<button class="pp-cond ${owned && k.k === cond ? "on" : ""}" data-k="${k.k}" style="--cc:${k.col}" ${owned ? "" : "disabled"}><span class="pp-k">${k.k}</span><span class="pp-cl">${k.fr}<small>${k.l} · ${Math.round(k.f * 100)} %</small></span><b>${eur(Math.max(0.02, fair * k.f))}</b>${owned && k.k === cond ? `<i class="pp-mine">Ma carte</i>` : ""}</button>`).join("")}</div>
        ${bars(f)}
        ${f.hint ? "" : `        <div class="pp-h">Détail Cardmarket</div>
        <div class="pp-rows">
          ${row("Tendance", f.trend)}${row("Moyenne 1 jour", f.avg1)}${row("Moyenne 7 jours", f.avg7)}${row("Moyenne 30 jours", f.avg30)}${row("Plus bas en vente", f.low, "souvent un exemplaire abîmé")}
          ${tpv?.marketPrice ? `<div class="pp-row"><span>TCGplayer (USA)<small>prix du marché</small></span><b>${tpv.marketPrice.toLocaleString("fr-BE", { style: "currency", currency: "USD" })}</b></div>` : ""}
        </div>`}`
      : `<div class="pp-main"><div class="pp-lbl">Prix</div><div class="pp-val sm">Pas encore de prix</div><div class="note">Cardmarket n'a pas encore assez de ventes pour cette carte (souvent le cas d'une extension toute récente).</div></div>`}
      <div class="pp-h">Comparer</div>
      <div class="pp-links">
        <a class="pill ghost" target="_blank" rel="noopener" href="https://www.cardmarket.com/fr/Pokemon/Products/Search?searchString=${qShort}">Cardmarket</a>
        <a class="pill ghost" target="_blank" rel="noopener" href="https://www.ebay.fr/sch/i.html?_nkw=${q}&LH_Sold=1&LH_Complete=1">eBay · vendues</a>
        <a class="pill ghost" target="_blank" rel="noopener" href="https://www.vinted.fr/catalog?search_text=${q}">Vinted</a>
      </div>
      <p class="note pp-foot">Le prix estimé (comme neuve) est le même que sur la fiche de la carte et dans la valeur de ta collection. Les prix par état suivent les écarts habituels sur Cardmarket. Pour voir les dernières ventes une par une, ouvre « eBay · vendues ».${cm?.updated ? ` Mis à jour le ${new Date(cm.updated).toLocaleDateString("fr-BE", { day: "numeric", month: "long" })}.` : ""}</p>`;
    el.querySelector(".pp-vers")?.addEventListener("click", e => { const b = e.target.closest("[data-v]"); if (b) { v = b.dataset.v; draw(); } });
    el.querySelector(".pp-conds")?.addEventListener("click", e => { const b = e.target.closest("[data-k]"); if (!b || !owned) return; setCond(c.id, b.dataset.k); cond = b.dataset.k; onChange?.(); draw(); });
  };
  draw();
}

/* average price over 30 days, 7 days, yesterday, and the trend: bars with their value (what Cardmarket publishes) */
function bars(f) {
  const pts = [["Moyenne 30 j", f.avg30], ["Moyenne 7 j", f.avg7], ["Hier", f.avg1], ["Tendance", f.trend]].filter(p => p[1] > 0);
  if (pts.length < 2) return "";
  const hi = Math.max(...pts.map(p => p[1]));
  const dir = pts[pts.length - 1][1] - pts[0][1];
  return `<div class="pp-h">Évolution du prix <small>${Math.abs(dir) < 0.01 ? "stable" : dir > 0 ? `en hausse de ${eur(dir)} sur 30 jours` : `en baisse de ${eur(-dir)} sur 30 jours`}</small></div>
    <div class="pp-bars ${dir >= 0 ? "up" : "dn"}">${pts.map(([l, x]) => `<div class="pp-bar"><b>${eur(x)}</b><i style="height:calc((100% - 46px) * ${Math.max(0.06, x / hi).toFixed(3)})"></i><span>${l}</span></div>`).join("")}</div>`;
}
