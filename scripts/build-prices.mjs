/* Builds public/prices/<setId>.json from Cardmarket's own daily files, so every card gets the price
   of ITS Cardmarket page.
   Why: TCGdex sometimes links a card to the wrong Cardmarket product when several products share a
   name (Générations: Pikachu 26/83 and Pikachu RC29 are both "Pikachu [Nuzzle | Quick Attack]").
   How: TCGdex gives each card a Cardmarket product; that link is KEPT unless it is provably wrong:
   a product with another name, attacks that do not match while another product's do, or one product
   given to two cards of the set. Those cards are matched again among the products of the same name:
   attacks first, then rarity against price. Runs before each build and every morning (GitHub Actions).
   Usage: node scripts/build-prices.mjs <outDir> [products.json] [price_guide.json] */
import fs from "node:fs/promises";
import path from "node:path";

const OUT = process.argv[2] || "public/prices";
const CM = "https://downloads.s3.cardmarket.com/productCatalog";
const TCGDEX = "https://api.tcgdex.net/v2";

async function json(url, tries = 3) {
  for (let i = 0; ; i++) {
    try { const r = await fetch(url); if (r.status === 404) return null; if (!r.ok) throw new Error(`${r.status} ${url}`); return await r.json(); }
    catch (e) { if (i >= tries - 1) throw e; await new Promise(r => setTimeout(r, 800 * (i + 1))); }
  }
}
const local = async (f, url) => f ? JSON.parse(await fs.readFile(f, "utf8")) : json(url);
async function pool(items, n, fn) { let i = 0; await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const k = i++; await fn(items[k], k); } })); }

const plain = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
// card name without its attacks ("Pikachu [Nuzzle | Quick Attack]"), its level ("Lv.72") or edition notes;
// short tags that are part of the name stay ([G] for SP Pokémon…)
const norm = s => plain(String(s || "").replace(/\[([^\]]*)\]/g, (m, x) => x.length <= 3 && !x.includes("|") ? x : "").replace(/\bLv\.?\s*\d+/gi, "").replace(/\(.*?\)/g, ""));
// attack / ability names inside the brackets of a Cardmarket product
const moves = s => new Set((String(s).match(/\[([^\]]{4,})\]/g) || []).flatMap(b => b.slice(1, -1).split("|").map(plain)).filter(Boolean));
// natural card order: 1, 2 … 83, then RC1, RC2 … RC32 (TCGdex lists RC10 before RC2)
const numOrder = id => { const m = /^([A-Za-z]*)(\d+)([a-z]*)$/.exec(id) || [0, id, 0, ""]; return [m[1] ? 1 : 0, m[1].toUpperCase(), +m[2] || 0, m[3]]; };
const cmp = (a, b) => { const x = numOrder(a), y = numOrder(b); for (let i = 0; i < 4; i++) if (x[i] !== y[i]) return x[i] < y[i] ? -1 : 1; return 0; };
const RAR = ["common", "uncommon", "rare", "rare holo", "holo rare", "double rare", "ace spec rare", "shiny rare", "radiant rare", "amazing rare", "ultra rare", "holo rare v", "holo rare vmax", "holo rare vstar", "illustration rare", "shiny ultra rare", "secret rare", "special illustration rare", "hyper rare", "mega hyper rare"];
const rarity = r => { const k = RAR.indexOf(String(r || "").toLowerCase()); return k < 0 ? 5 : k; };
const day = s => (s && !s.startsWith("0000") ? Date.parse(s.replace(" ", "T") + "Z") : NaN);
const r2 = x => x ? Math.round(x * 100) / 100 : 0;

const [products, guide] = await Promise.all([
  local(process.argv[3], `${CM}/productList/products_singles_6.json`),
  local(process.argv[4], `${CM}/priceGuide/price_guide_6.json`)
]);
const price = new Map(guide.priceGuides.map(g => [g.idProduct, g]));
const prodById = new Map(products.products.map(p => [p.idProduct, p]));
const byExp = new Map();
for (const p of products.products) (byExp.get(p.idExpansion) || byExp.set(p.idExpansion, []).get(p.idExpansion)).push(p);

const sets = await json(`${TCGDEX}/en/sets`);
await fs.mkdir(OUT, { recursive: true });
const report = { sets: 0, cards: 0, matched: 0, fixed: 0, examples: [] };

const line = p => { const g = price.get(p.idProduct); return g && [p.idProduct, r2(g.trend), r2(g.avg1), r2(g.avg7), r2(g.avg30), r2(g.low), r2(g["trend-holo"]), r2(g["avg1-holo"]), r2(g["avg7-holo"]), r2(g["avg30-holo"]), r2(g["low-holo"])]; };
const movesOf = d => new Set([...(d?.attacks || []), ...(d?.abilities || [])].map(a => plain(a.name)));
// how well a product fits a card: same attacks (+1 each), attacks that don't match at all (-1)
const fit = (p, mine) => { const pm = moves(p.name); let n = 0; for (const m of pm) if (mine.has(m)) n++; return pm.size && mine.size && !n ? -1 : n; };

await pool(sets, 4, async ({ id }) => {
  const s = await json(`${TCGDEX}/en/sets/${encodeURIComponent(id)}`).catch(() => null);
  if (!s?.cards?.length) return;
  const cards = s.cards.slice().sort((a, b) => cmp(a.localId, b.localId));
  const det = new Map();
  await pool(cards, 8, async c => det.set(c.id, await json(`${TCGDEX}/en/cards/${encodeURIComponent(c.id)}`).catch(() => null)));
  const link = c => prodById.get(det.get(c.id)?.pricing?.cardmarket?.idProduct);
  // the set's Cardmarket extension: where most of TCGdex's links point
  const votes = new Map();
  for (const c of cards) { const p = link(c); if (p) votes.set(p.idExpansion, (votes.get(p.idExpansion) || 0) + 1); }
  const exp = [...votes].sort((a, b) => b[1] - a[1])[0]?.[0];
  if (!exp) return;
  const all = (byExp.get(exp) || []).slice().sort((a, b) => a.idProduct - b.idProduct);
  const dates = all.map(p => day(p.dateAdded)).filter(Number.isFinite).sort((a, b) => a - b);
  const first = dates[Math.floor(dates.length * 0.1)] ?? NaN;
  const recent = p => !Number.isFinite(first) || !Number.isFinite(day(p.dateAdded)) || day(p.dateAdded) - first < 200 * 864e5;
  const cands = new Map();
  for (const p of all) if (recent(p)) (cands.get(norm(p.name)) || cands.set(norm(p.name), []).get(norm(p.name))).push(p);
  const shared = new Map();
  for (const c of cards) { const p = link(c); if (p) shared.set(p.idProduct, (shared.get(p.idProduct) || 0) + 1); }

  // TCGdex's link is kept unless it is provably wrong: another card's name, attacks that don't match
  // while another product's do, or the same product given to two cards of the set (Pikachu 26/83 and RC29)
  const out = {}, wrong = [];
  for (const c of cards) {
    const p = link(c), ps = cands.get(norm(c.name)) || [], mine = movesOf(det.get(c.id));
    const ok = p && p.idExpansion === exp && norm(p.name) === norm(c.name) && shared.get(p.idProduct) === 1
      && !(fit(p, mine) < 0 && ps.some(q => fit(q, mine) > 0));
    if (ok) out[c.localId] = line(p);
    else if (ps.length) wrong.push(c);
  }
  // the wrong ones: free products of the same name, best attacks first, then rarer card ↔ dearer product
  const taken = new Set(Object.values(out).filter(Boolean).map(x => x[0]));
  const groups = new Map();
  for (const c of wrong) (groups.get(norm(c.name)) || groups.set(norm(c.name), []).get(norm(c.name))).push(c);
  for (const [name, cs] of groups) {
    let free = (cands.get(name) || []).filter(p => !taken.has(p.idProduct));
    const left = [];
    for (const c of cs) {
      const mine = movesOf(det.get(c.id)), sc = free.map(p => fit(p, mine)), top = Math.max(-1, ...sc);
      const best = free.filter((_, k) => sc[k] === top);
      if (best.length === 1 && top > 0) { out[c.localId] = line(best[0]); taken.add(best[0].idProduct); free = free.filter(p => p !== best[0]); }
      else left.push(c);
    }
    if (!left.length || !free.length) continue;
    // keep the cards' own TCGdex products in the race (one of them is right)
    const pool2 = [...new Set([...left.map(link).filter(p => p && norm(p.name) === name && !taken.has(p.idProduct)), ...free])];
    const rs = left.map(c => rarity(det.get(c.id)?.rarity));
    let byRar, chosen;
    if (new Set(rs).size === 1) {
      // same rarity everywhere (old sets: holo and plain are both "Rare"): Cardmarket's order = card order
      byRar = left; chosen = pool2.sort((x, y) => x.idProduct - y.idProduct).slice(0, left.length);
    } else {
      // rarer card ↔ dearer product; extra products (reprints…) skipped from the middle
      byRar = left.map((c, i) => [c, rs[i]]).sort((x, y) => x[1] - y[1]).map(x => x[0]);
      pool2.sort((x, y) => (price.get(x.idProduct)?.trend || 0) - (price.get(y.idProduct)?.trend || 0));
      chosen = pool2.length <= byRar.length ? pool2 : [...pool2.slice(0, Math.ceil(byRar.length / 2)), ...pool2.slice(pool2.length - Math.floor(byRar.length / 2))];
    }
    byRar.forEach((c, k) => { if (chosen[k]) out[c.localId] = line(chosen[k]); });
  }
  for (const c of cards) {
    const t = link(c)?.idProduct, o = out[c.localId]?.[0];
    if (t && o && t !== o) { report.fixed++; if (report.examples.length < 15) report.examples.push(`${c.id} ${c.name}: TCGdex ${t} (${price.get(t)?.trend}) → ${o} (${price.get(o)?.trend})`); }
  }
  for (const k of Object.keys(out)) if (!out[k]) delete out[k];
  report.sets++; report.cards += cards.length; report.matched += Object.keys(out).length;
  await fs.writeFile(path.join(OUT, `${id}.json`), JSON.stringify({ at: guide.createdAt, exp, c: out }));
});
await fs.writeFile(path.join(OUT, "index.json"), JSON.stringify({ at: guide.createdAt, sets: report.sets }));
console.log(`prix Cardmarket : ${report.matched}/${report.cards} cartes dans ${report.sets} extensions ; ${report.fixed} liens TCGdex corrigés`);
report.examples.forEach(x => console.log("  " + x));
