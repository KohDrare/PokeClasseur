import { openCard } from "../components/card-modal.js";
import { loadSet, logoImg, peekSet } from "../data/tcgdex.js";
import { rarity, symHTML } from "../features/rarity.js";
import { eur, foilOf, fxHTML, priceOf } from "../features/variants.js";
import { $, esc } from "../lib/core.js";
import { imgTag, numLabel, setNav } from "../lib/ui.js";
import { renderStats } from "./home.js";
import { ownedAny, ownedBySet } from "../state/collection.js";
import { S } from "../state/shared.js";

/* ================= COLLECTION ================= */
export async function renderCollection() {
  setNav("col"); S.CUR = null;
  const app = $("#app");
  const by = ownedBySet();
  const ids = Object.keys(by);
  app.innerHTML = `<section class="band"><div class="wrap"><h1>Ma collection</h1><p class="sub">Toutes les cartes que tu as cochées, rangées par extension.</p><div class="stats" id="stats"></div></div></section>
    <div class="wrap"><div class="toolbar"><div class="seg" id="sort"><button data-s="num" class="on">Par numéro</button><button data-s="rar">Les plus rares d'abord</button><button data-s="price">Les plus chères</button></div></div><div id="colbody"></div></div>`;
  renderStats();
  if (!ids.length) { $("#colbody").innerHTML = `<div class="empty-state"><b>Ta collection est vide pour l'instant</b>Va dans <a href="#/">Séries</a>, ouvre une extension et coche tes cartes.</div>`; return; }
  $("#colbody").innerHTML = `<div class="empty-state"><b>Préparation de ta vitrine…</b></div>`;
  const sets = [];
  for (const id of ids) { let s = await peekSet(id); if (!s) { try { s = await loadSet(id); } catch { continue; } } sets.push(s); }
  sets.sort((a, b) => (b.info.date || "").localeCompare(a.info.date || ""));
  let sort = "num";
  const draw = () => {
    $("#colbody").innerHTML = sets.map((s, si) => {
      let cs = s.cards.filter(c => ownedAny(c.id));
      if (sort === "rar") cs = [...cs].sort((a, b) => rarity(b.r).rank - rarity(a.r).rank);
      if (sort === "price") cs = [...cs].sort((a, b) => (b.p || 0) - (a.p || 0));
      const val = cs.reduce((t, c) => t + Object.entries(S.COL.cards[c.id].v).reduce((x, [v, n]) => x + priceOf(c, v) * n, 0), 0);
      const pct = Math.round(cs.length / s.cards.length * 100);
      return `<section class="colset"><div class="colhead">${logoImg(s.info.id, s.info.logo, s.info.name, s.info.serie?.id, true)}<h3><a href="#/set/${encodeURIComponent(s.info.id)}" style="text-decoration:none">${esc(s.info.name)}</a></h3><a class="note slink" href="#/stats/${encodeURIComponent(s.info.id)}">${cs.length} / ${s.cards.length} cartes · ${pct} % · ${eur(val)} · Stats ›</a></div>
        <div class="grid">${cs.map((c, i) => { const q = Object.values(S.COL.cards[c.id].v).reduce((a, b) => a + b, 0);
          return `<div class="tile owned"><button class="cardimg" data-s="${si}" data-i="${i}" aria-label="${esc(c.name)}">${imgTag(c, "low")}${fxHTML(foilOf(c))}</button>${q > 1 ? `<span class="qty">×${q}</span>` : ""}<div class="cap"><span class="n">${esc(numLabel(c, s.info))}</span>${symHTML(c.r)}<span class="nm">${esc(c.name)}</span><span class="pr">${c.p ? eur(c.p) : ""}</span></div></div>`; }).join("")}</div></section>`;
    }).join("");
    $("#colbody").onclick = e => {
      const b = e.target.closest("[data-s]"); if (!b) return;
      const s = sets[+b.dataset.s];
      let cs = s.cards.filter(c => ownedAny(c.id));
      if (sort === "rar") cs = [...cs].sort((a, b) => rarity(b.r).rank - rarity(a.r).rank);
      if (sort === "price") cs = [...cs].sort((a, b) => (b.p || 0) - (a.p || 0));
      const seq = cs.map(c => Object.assign(c, { _info: s.info }));
      S.CUR = null; openCardWithInfo(seq[+b.dataset.i], seq, s.info);
    };
  };
  $("#sort").onclick = e => { const b = e.target.closest("button"); if (!b) return; sort = b.dataset.s; [...e.currentTarget.children].forEach(x => x.classList.toggle("on", x === b)); draw(); };
  draw();
}
export function openCardWithInfo(c, seq, info) { const prev = S.CUR; S.CUR = { data: { info } }; openCard(c, seq); S.CUR = prev; }
