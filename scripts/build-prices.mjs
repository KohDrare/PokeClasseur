/* Builds public/prices/<setId>.json from Cardmarket's own daily files, so every card gets the price
   of ITS Cardmarket page.
   Why: TCGdex sometimes links a card to the wrong Cardmarket product when several products share a
   name (Générations: Pikachu 26/83 and Pikachu RC29 are both "Pikachu [Nuzzle | Quick Attack]").
   How: Cardmarket publishes every product (name, extension) and every price guide. For each set we
   find its Cardmarket extension, then match cards by English name; cards sharing a name are matched
   in order (Cardmarket adds an extension's products in card order), leaving out products added long
   after the release (stamped reprints…). Runs before each build and every morning (GitHub Actions).
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

await pool(sets, 6, async ({ id }) => {
  const s = await json(`${TCGDEX}/en/sets/${encodeURIComponent(id)}`).catch(() => null);
  if (!s?.cards?.length) return;
  // the set's Cardmarket extension: where TCGdex's own product links point (majority of a sample)
  const sample = s.cards.filter((_, i) => i % Math.max(1, Math.floor(s.cards.length / 6)) === 0).slice(0, 6);
  const tcgdexProd = new Map(), votes = new Map();
  for (const c of sample) {
    const d = await json(`${TCGDEX}/en/cards/${encodeURIComponent(c.id)}`).catch(() => null);
    const pid = d?.pricing?.cardmarket?.idProduct, p = pid && prodById.get(pid);
    if (p) { tcgdexProd.set(c.id, pid); votes.set(p.idExpansion, (votes.get(p.idExpansion) || 0) + 1); }
  }
  const exp = [...votes].sort((a, b) => b[1] - a[1])[0]?.[0];
  if (!exp) return;
  const all = (byExp.get(exp) || []).slice().sort((a, b) => a.idProduct - b.idProduct);
  // products of the release (not reprints added years later)
  const dates = all.map(p => day(p.dateAdded)).filter(Number.isFinite).sort((a, b) => a - b);
  const first = dates[Math.floor(dates.length * 0.1)] ?? NaN;
  const recent = p => !Number.isFinite(first) || !Number.isFinite(day(p.dateAdded)) || day(p.dateAdded) - first < 200 * 864e5;
  const cands = new Map();
  for (const p of all) if (recent(p)) (cands.get(norm(p.name)) || cands.set(norm(p.name), []).get(norm(p.name))).push(p);
  const cards = s.cards.slice().sort((a, b) => cmp(a.localId, b.localId));
  const byName = new Map();
  for (const c of cards) (byName.get(norm(c.name)) || byName.set(norm(c.name), []).get(norm(c.name))).push(c);

  const out = {};
  for (const [name, cs] of byName) {
    const ps = cands.get(name) || [];
    if (!ps.length || ps.length < cs.length) continue;   // can't tell which is which
    let pick = cs.map((_, i) => ps[i]);
    if (ps.length > 1) {
      // several products with this name. 1) same attacks; 2) among equals, TCGdex's own link when no
      // other card of the group shares it; 3) what is left: rarer card ↔ more expensive product
      const det = await Promise.all(cs.map(c => json(`${TCGDEX}/en/cards/${encodeURIComponent(c.id)}`).catch(() => null)));
      const link = det.map(d => d?.pricing?.cardmarket?.idProduct);
      cs.forEach((c, i) => { if (link[i]) tcgdexProd.set(c.id, link[i]); });
      const ties = det.map(d => {
        const mine = new Set([...(d?.attacks || []), ...(d?.abilities || [])].map(a => plain(a.name)));
        const sc = ps.map(p => { const pm = moves(p.name); let n = 0; for (const m of pm) if (mine.has(m)) n++; return pm.size && mine.size && !n ? -1 : n; });
        const top = Math.max(...sc); return ps.filter((_, k) => sc[k] === top);
      });
      const used = new Set(); pick = cs.map(() => null);
      const free = i => ties[i].filter(p => !used.has(p));
      for (let again = true; again;) { again = false; cs.forEach((_, i) => { if (!pick[i] && free(i).length === 1) { pick[i] = free(i)[0]; used.add(pick[i]); again = true; } }); }
      cs.forEach((_, i) => {
        if (pick[i] || !link[i] || link.filter(x => x === link[i]).length > 1) return;
        const p = free(i).find(x => x.idProduct === link[i]); if (p) { pick[i] = p; used.add(p); }
      });
      const left = cs.map((_, i) => i).filter(i => !pick[i]);
      if (left.length) {
        const pool2 = [...new Set(left.flatMap(free))].sort((x, y) => (price.get(x.idProduct)?.trend || 0) - (price.get(y.idProduct)?.trend || 0));
        const byRar = left.slice().sort((x, y) => rarity(det[x]?.rarity) - rarity(det[y]?.rarity) || x - y);
        // as many products as cards: cheapest to the commonest; extra products (reprints…) are skipped from the middle
        const chosen = pool2.length <= byRar.length ? pool2 : [...pool2.slice(0, Math.ceil(byRar.length / 2)), ...pool2.slice(pool2.length - Math.floor(byRar.length / 2))];
        byRar.forEach((i, k) => { pick[i] = chosen[k] || null; });
      }
    }
    cs.forEach((c, i) => {
      const p = pick[i], g = p && price.get(p.idProduct); if (!g) return;
      out[c.localId] = [p.idProduct, r2(g.trend), r2(g.avg1), r2(g.avg7), r2(g.avg30), r2(g.low), r2(g["trend-holo"]), r2(g["avg1-holo"]), r2(g["avg7-holo"]), r2(g["avg30-holo"]), r2(g["low-holo"])];
      const t = tcgdexProd.get(c.id);
      if (t && t !== p.idProduct) { report.fixed++; if (report.examples.length < 12) report.examples.push(`${c.id} ${c.name}: TCGdex ${t} → ${p.idProduct}`); }
    });
  }
  report.sets++; report.cards += cards.length; report.matched += Object.keys(out).length;
  await fs.writeFile(path.join(OUT, `${id}.json`), JSON.stringify({ at: guide.createdAt, exp, c: out }));
});
await fs.writeFile(path.join(OUT, "index.json"), JSON.stringify({ at: guide.createdAt, sets: report.sets }));
console.log(`prix Cardmarket : ${report.matched}/${report.cards} cartes dans ${report.sets} extensions ; ${report.fixed} liens TCGdex corrigés (sur l'échantillon)`);
report.examples.forEach(x => console.log("  " + x));
