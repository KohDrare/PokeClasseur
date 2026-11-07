/* Price page of a card (the "€" button): a fair price that resists one-off sales, the price by condition,
   the Cardmarket details and links to compare (Cardmarket, eBay sold items, Vinted).
   Prices are fetched fresh from TCGdex (Cardmarket in €, TCGplayer in $) when the page opens. */
import { getJSON } from "../data/tcgdex.js";
import { $, API, ICON, esc } from "../lib/core.js";
import { imgTag, numLabel } from "../lib/ui.js";
import { VARIANT_LABEL, eur, variantsOf } from "./variants.js";

/* how much a card is worth by condition, as a share of a near-mint copy (usual Cardmarket ratios) */
export const CONDITIONS = [
  { k: "NM", l: "Near Mint", fr: "Comme neuve", f: 1 },
  { k: "EX", l: "Excellent", fr: "Très bon état", f: 0.85 },
  { k: "GD", l: "Good", fr: "Bon état", f: 0.7 },
  { k: "LP", l: "Light Played", fr: "Légèrement jouée", f: 0.55 },
  { k: "PL", l: "Played", fr: "Jouée", f: 0.4 },
  { k: "PO", l: "Poor", fr: "Abîmée", f: 0.25 }
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

export async function openPricePage(c, info, startV) {
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

  const draw = () => {
    const f = figures(cm, v);
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
          <div class="pp-lbl">Prix estimé · comme neuve</div>
          <div class="pp-val">${eur(fair)}</div>
          ${f.lo && f.hi && f.hi - f.lo > 0.01 ? `<div class="note">Fourchette récente : ${eur(f.lo)} – ${eur(f.hi)}</div>` : ""}
          ${spark(f)}
        </div>
        <div class="pp-h">Selon l'état</div>
        <div class="pp-conds">${CONDITIONS.map(k => `<div class="pp-cond"><span class="pp-k">${k.k}</span><span class="pp-cl">${k.fr}<small>${k.l} · ${Math.round(k.f * 100)} %</small></span><b>${eur(Math.max(0.02, fair * k.f))}</b></div>`).join("")}</div>
        <div class="pp-h">Détail Cardmarket</div>
        <div class="pp-rows">
          ${row("Tendance", f.trend)}${row("Moyenne 1 jour", f.avg1)}${row("Moyenne 7 jours", f.avg7)}${row("Moyenne 30 jours", f.avg30)}${row("Plus bas en vente", f.low, "souvent un exemplaire abîmé")}
          ${tpv?.marketPrice ? `<div class="pp-row"><span>TCGplayer (USA)<small>prix du marché</small></span><b>${tpv.marketPrice.toLocaleString("fr-BE", { style: "currency", currency: "USD" })}</b></div>` : ""}
        </div>`
      : `<div class="pp-main"><div class="pp-lbl">Prix</div><div class="pp-val sm">Pas encore de prix</div><div class="note">Cardmarket n'a pas encore assez de ventes pour cette carte (souvent le cas d'une extension toute récente).</div></div>`}
      <div class="pp-h">Comparer</div>
      <div class="pp-links">
        <a class="pill ghost" target="_blank" rel="noopener" href="https://www.cardmarket.com/fr/Pokemon/Products/Search?searchString=${qShort}">Cardmarket</a>
        <a class="pill ghost" target="_blank" rel="noopener" href="https://www.ebay.fr/sch/i.html?_nkw=${q}&LH_Sold=1&LH_Complete=1">eBay · vendues</a>
        <a class="pill ghost" target="_blank" rel="noopener" href="https://www.vinted.fr/catalog?search_text=${q}">Vinted</a>
      </div>
      <p class="note pp-foot">Le prix estimé est la valeur du milieu entre la tendance Cardmarket et ses moyennes sur 7 et 30 jours : une vente isolée trop chère ou bradée ne le fausse pas. Les prix par état suivent les écarts habituels sur Cardmarket.${cm?.updated ? ` Mis à jour le ${new Date(cm.updated).toLocaleDateString("fr-BE", { day: "numeric", month: "long" })}.` : ""}</p>`;
    el.querySelector(".pp-vers")?.addEventListener("click", e => { const b = e.target.closest("[data-v]"); if (b) { v = b.dataset.v; draw(); } });
  };
  draw();
}

/* small line: 30 days → 7 days → yesterday → trend */
function spark(f) {
  const pts = [["30 j", f.avg30], ["7 j", f.avg7], ["1 j", f.avg1], ["Tendance", f.trend]].filter(p => p[1] > 0);
  if (pts.length < 2) return "";
  const lo = Math.min(...pts.map(p => p[1])), hi = Math.max(...pts.map(p => p[1])), W = 300, H = 60;
  const X = i => 10 + i * (W - 20) / (pts.length - 1), Y = x => hi === lo ? H / 2 : H - 8 - (x - lo) / (hi - lo) * (H - 16);
  const d = pts.map((p, i) => `${i ? "L" : "M"}${X(i).toFixed(1)} ${Y(p[1]).toFixed(1)}`).join("");
  const up = pts[pts.length - 1][1] >= pts[0][1];
  return `<div class="pp-spark ${up ? "up" : "dn"}"><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"><path d="${d}" class="ln"/></svg><div class="pp-ticks">${pts.map(p => `<span>${p[0]}</span>`).join("")}</div></div>`;
}
