import { openCard } from "../components/card-modal.js";
import { loadSet, logoImg } from "../data/tcgdex.js";
import { buyTile, loadProdPhotos, openBuyPicker, openProductForm, prodsOf } from "../features/products.js";
import { rarity, symSVG } from "../features/rarity.js";
import { eur, foilOf, fxHTML, isSpecial, mainVariant, priceOf, rareShort, variantsOf } from "../features/variants.js";
import { $, ICON, esc } from "../lib/core.js";
import { imgTag, numLabel, setNav } from "../lib/ui.js";
import { ownedAny, qtyOf } from "../state/collection.js";
import { S } from "../state/shared.js";

/* ================= SET STATS PAGE ================= */
export async function renderSetStats(setId) {
  setNav("series");
  const app = $("#app");
  app.innerHTML = `<section class="band"><div class="wrap" id="sthead"><a class="crumb" href="#/set/${encodeURIComponent(setId)}">${ICON.back} Retour à l'extension</a><div class="empty-state"><b>Calcul de tes stats…</b></div></div></section><div class="wrap" id="stbody"></div>`;
  let data;
  try { data = await loadSet(setId); } catch { $("#sthead").innerHTML += `<div class="empty-state"><b>Impossible de charger cette extension</b>Vérifie ta connexion puis réessaie.</div>`; return; }
  if (location.hash !== "#/stats/" + setId && decodeURIComponent(location.hash) !== "#/stats/" + setId) return;
  const prevCur = S.CUR; S.CUR = { setId, data, rar: new Set(), q: "", page: 0, loading: 1 }; /* rarity helpers read the set's official count */
  const { info, cards } = data;
  const vmap = c => S.COL.cards[c.id]?.v || {};
  const copiesOf = c => Object.values(vmap(c)).reduce((a, b) => a + b, 0);
  const valueOf = c => Object.entries(vmap(c)).reduce((a, [v, n]) => a + priceOf(c, v) * n, 0);
  const own = cards.filter(c => ownedAny(c.id));
  const missing = cards.filter(c => !ownedAny(c.id));
  let vOwn = 0, vTot = 0, revOwn = 0, revTot = 0;
  for (const c of cards) for (const v of variantsOf(c)) { vTot++; const h = qtyOf(c.id, v) > 0; if (h) vOwn++; if (v === "reverse") { revTot++; if (h) revOwn++; } }
  const copies = own.reduce((a, c) => a + copiesOf(c), 0);
  const doubles = own.filter(c => copiesOf(c) > 1);
  const extra = doubles.reduce((a, c) => a + copiesOf(c) - 1, 0);
  const value = own.reduce((a, c) => a + valueOf(c), 0);
  const toComplete = missing.reduce((a, c) => a + (priceOf(c, mainVariant(c)) || 0), 0);
  const official = info.official || cards.length;
  const isMain = c => /^\d+$/.test(c.n) && +c.n <= official;
  const ownMain = own.filter(isMain).length, ownSecret = own.length - ownMain, nSecret = cards.length - official;
  const prods = prodsOf(setId);
  const spent = prods.reduce((a, p) => a + p.qty * (p.price || 0), 0);
  const boosters = prods.reduce((a, p) => a + p.opened * p.bpp, 0);
  const spentOpened = prods.reduce((a, p) => a + p.opened * (p.price || 0), 0);
  const perBooster = boosters ? spentOpened / boosters : 0;
  const sealedLeft = prods.reduce((a, p) => a + (p.qty - p.opened), 0);
  const sealedVal = prods.reduce((a, p) => a + (p.qty - p.opened) * (p.price || 0), 0);
  const balance = value - spent;
  const pct = Math.round(own.length / cards.length * 100);
  /* hits = copies of special rares (ex, full art, illustrations, gold…) */
  const hitCards = own.filter(isSpecial);
  const hits = hitCards.reduce((a, c) => a + copiesOf(c), 0);
  const hitGroups = new Map();
  for (const c of cards.filter(isSpecial)) {
    const k = rareShort(c), r = rarity(c.r);
    if (!hitGroups.has(k)) hitGroups.set(k, { name: k, sym: r.sym, rank: r.rank, n: 0, o: 0, copies: 0 });
    const g = hitGroups.get(k); g.n++; if (ownedAny(c.id)) { g.o++; g.copies += copiesOf(c); }
  }
  const hitRows = [...hitGroups.values()].sort((a, b) => a.rank - b.rank);
  const rarGroups = new Map();
  for (const c of cards) { const r = rarity(c.r); if (!rarGroups.has(r.sym)) rarGroups.set(r.sym, { r, labels: new Set(), n: 0, o: 0 }); const g = rarGroups.get(r.sym); g.labels.add(c.r || "Sans rareté"); g.n++; if (ownedAny(c.id)) g.o++; }
  const rarRows = [...rarGroups.values()].sort((a, b) => a.r.rank - b.r.rank);
  const best = [...own].sort((a, b) => valueOf(b) - valueOf(a));
  const count = (arr, f) => { const m = new Map(); for (const c of arr) for (const k of [].concat(f(c) || [])) if (k) m.set(k, (m.get(k) || 0) + 1); return [...m.entries()].sort((a, b) => b[1] - a[1]); };
  const topIll = count(own, c => c.il)[0], topType = count(own.filter(c => c.t), c => c.t.split(", "))[0];
  const nPoke = own.filter(c => c.cat === "Pokémon").length, nTrainer = own.filter(c => c.cat === "Dresseur").length, nEnergy = own.filter(c => c.cat === "Énergie").length;
  const money = n => n ? eur(n) : "0 €";
  const plural = (n, w) => `${n} ${w}${n > 1 ? "s" : ""}`;
  const tile = (c, sub) => `<button class="tile ${ownedAny(c.id) ? "owned" : "missing"} stile" data-card="${esc(c.id)}"><span class="cardimg">${imgTag(c, "low")}${fxHTML(foilOf(c))}</span><span class="cap"><span class="n">${esc(numLabel(c, info))}</span><span class="nm">${esc(c.name)}</span><span class="pr">${sub}</span></span></button>`;

  $("#sthead").innerHTML = `<a class="crumb" href="#/set/${encodeURIComponent(setId)}">${ICON.back} Retour à l'extension</a>
    <div class="sthero">
      <div class="logo">${logoImg(info.id, info.logo, info.name, info.serie?.id, true)}</div>
      <div class="sttitle"><div class="eyebrow">Stats de ta collection</div><h1>${esc(info.name)}</h1>
      <div class="progress"><div class="ring" style="--p:${pct}" data-l="${pct}%"></div><div><div class="t">${own.length} / ${cards.length} cartes</div><div class="s">${vOwn} / ${vTot} versions · ${ownMain}/${official} normales${nSecret > 0 ? ` · ${ownSecret}/${nSecret} secrètes` : ""}</div></div></div></div>
    </div>`;

  $("#stbody").innerHTML = `
    <div class="kpis">
      <div class="kpi accent"><span>Valeur de ta collection</span><b>${money(value)}</b><small>prix tendance Cardmarket</small></div>
      <div class="kpi"><span>Argent investi</span><b>${money(spent)}</b><small>${prods.length ? plural(prods.length, "achat") + " noté" + (prods.length > 1 ? "s" : "") : "aucun achat noté"}</small></div>
      <div class="kpi ${spent ? (balance >= 0 ? "good" : "bad") : ""}"><span>Bilan</span><b>${spent ? (balance >= 0 ? "+" : "−") + money(Math.abs(balance)) : "–"}</b><small>valeur des cartes − argent investi</small></div>
      <div class="kpi"><span>Boosters ouverts</span><b>${boosters}</b><small>${perBooster ? `${eur(perBooster)} le booster en moyenne` : "ajoute tes achats pour le prix"}</small></div>
      <div class="kpi"><span>Hits</span><b>${hits}</b><small>${boosters && hits ? `1 hit tous les ${(boosters / hits).toFixed(1).replace(".", ",")} boosters` : boosters ? "aucun hit pour l'instant" : "ex, Full Art, illustrations, Gold…"}</small></div>
      <div class="kpi"><span>Valeur tirée par booster</span><b>${boosters ? eur(value / boosters) : "–"}</b><small>${boosters && perBooster ? (value / boosters >= perBooster ? "plus que le prix payé" : "moins que le prix payé") : "valeur ÷ boosters ouverts"}</small></div>
      <div class="kpi"><span>Exemplaires</span><b>${copies}</b><small>${extra ? plural(extra, "carte") + " en double" : "aucun double"}</small></div>
      <div class="kpi"><span>Pour compléter</span><b>${money(toComplete)}</b><small>${plural(missing.length, "carte")} manquante${missing.length > 1 ? "s" : ""}</small></div>
    </div>

    <section class="stsec"><div class="sthead2"><h2>Tes achats</h2><button class="pill" id="add-buy">+ Ajouter un achat</button></div>
      ${prods.length ? `<div class="buys">${prods.map(p => buyTile(p, info)).join("")}</div>${sealedLeft ? `<p class="note" style="margin-top:10px">${plural(sealedLeft, "produit")} encore scellé${sealedLeft > 1 ? "s" : ""}, pour ${money(sealedVal)}.</p>` : ""}`
        : `<div class="empty-state" style="padding:24px 0"><b>Aucun achat noté</b>Ajoute tes boosters, displays et coffrets pour voir l'argent investi, le prix moyen d'un booster et ton taux de hit.</div>`}
    </section>

    <div class="stcols">
      <section class="stsec"><h2>Ton taux de hit</h2>
        <div class="panel">
          ${hitRows.length ? `<div class="hitrows"><div class="hitrow head"><span>Rareté</span><span>Tirées</span><span>Différentes</span><span>Taux</span></div>${hitRows.map(g => `<div class="hitrow"><span class="rl">${symSVG(g.sym)}<span>${esc(g.name)}</span></span><span>${g.copies}</span><span>${g.o}/${g.n}</span><span>${boosters && g.copies ? `1 / ${Math.round(boosters / g.copies)}` : "–"}</span></div>`).join("")}</div>
          <p class="note" style="margin-top:10px">« 1 / 12 » veut dire une carte de cette rareté tous les 12 boosters ouverts. Les cartes achetées à l'unité comptent aussi.</p>` : `<p class="note">Cette extension n'a pas de rares spéciales.</p>`}
        </div>
      </section>
      <section class="stsec"><h2>Par rareté</h2>
        <div class="panel rrows">${rarRows.map(g => { const p = Math.round(g.o / g.n * 100); return `<div class="rrow"><span class="rl">${symSVG(g.r.sym)}<span>${esc([...g.labels].join(" · "))}</span></span><span class="rbar"><i style="width:${p}%"></i></span><span class="rn">${g.o}/${g.n}</span></div>`; }).join("")}</div>
      </section>
    </div>

    <section class="stsec"><h2>En bref</h2>
      <div class="facts2">
        ${best[0] ? `<div><span>Ta carte la plus chère</span><b>${esc(best[0].name)}</b><small>${eur(valueOf(best[0]))}</small></div>` : ""}
        <div><span>Reverse complétées</span><b>${revOwn} / ${revTot}</b><small>${revTot ? Math.round(revOwn / revTot * 100) : 0} % des reverse</small></div>
        <div><span>Répartition</span><b>${nPoke} Pokémon</b><small>${plural(nTrainer, "Dresseur")} · ${plural(nEnergy, "Énergie")}</small></div>
        ${topType ? `<div><span>Type le plus présent</span><b>${esc(topType[0])}</b><small>${plural(topType[1], "carte")}</small></div>` : ""}
        ${topIll ? `<div><span>Illustrateur préféré</span><b>${esc(topIll[0])}</b><small>${plural(topIll[1], "carte")} dans ta collection</small></div>` : ""}
        <div><span>Valeur moyenne d'une carte</span><b>${copies ? eur(value / copies) : "–"}</b><small>sur tes ${plural(copies, "exemplaire")}</small></div>
      </div>
    </section>

    ${best.length ? `<section class="stsec"><h2>Tes cartes les plus chères</h2><div class="grid smallgrid">${best.slice(0, 8).map(c => tile(c, eur(valueOf(c)))).join("")}</div></section>` : ""}
    ${doubles.length ? `<section class="stsec"><h2>Tes doubles <small>${plural(extra, "carte")} à échanger</small></h2><div class="grid smallgrid">${doubles.map(c => tile(c, "×" + copiesOf(c))).join("")}</div></section>` : ""}
    ${missing.length ? `<section class="stsec"><h2>Les manquantes les plus chères</h2><div class="grid smallgrid">${[...missing].sort((a, b) => (b.p || 0) - (a.p || 0)).slice(0, 8).map(c => tile(c, c.p ? eur(c.p) : "")).join("")}</div></section>` : ""}
    <p class="note" style="padding-block:24px 60px">Prix : tendance Cardmarket du jour (via TCGdex). Les reverse utilisent le prix reverse quand il existe.</p>`;

  const redraw = () => { if (location.hash.startsWith("#/stats/")) renderSetStats(setId); };
  $("#add-buy").onclick = () => openBuyPicker(info, redraw);
  $("#stbody").querySelectorAll("[data-edit]").forEach(b => b.onclick = () => openProductForm(info, prods.find(p => p.id === b.dataset.edit), redraw));
  $("#stbody").querySelectorAll("[data-card]").forEach(b => b.onclick = () => { const c = cards.find(x => x.id === b.dataset.card); openCard(c, cards); });
  loadProdPhotos($("#stbody"));
  void prevCur;
}
