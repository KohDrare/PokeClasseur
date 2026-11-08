/* Cardmarket prices of every card, from Cardmarket's own daily price guide.
   The files (prices/<setId>.json) are built by scripts/build-prices.mjs before each publication and every
   morning: each card is matched to ITS Cardmarket page (TCGdex sometimes picks a look-alike product,
   e.g. Pikachu 26/83 instead of Pikachu RC29). One line per card number:
   [idProduct, trend, avg1, avg7, avg30, low, trendReverse, avg1Reverse, avg7Reverse, avg30Reverse, lowReverse] */
import { idb } from "../lib/storage.js";

const BASE = import.meta.env.BASE_URL || "/";
const mem = new Map();
export const CM_V = 3;   // raise to make every device take the price files again at once
const median = xs => { const v = xs.filter(x => x > 0).sort((a, b) => a - b); if (!v.length) return 0; const m = v.length >> 1; return Math.round((v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2) * 100) / 100; };

/** { at, c: { number → line } } of an extension, or null when there is none (kept 12 h on this device) */
export function cmSet(setId) {
  if (mem.has(setId)) return mem.get(setId);
  const p = (async () => {
    const key = `cm${CM_V}:${setId}`, cached = await idb.get(key).catch(() => null);
    if (cached && Date.now() - cached.got < 12 * 36e5) return cached.data;
    try {
      const r = await fetch(`${BASE}prices/${encodeURIComponent(setId)}.json`);
      const data = r.ok ? await r.json() : null;
      await idb.set(key, { got: Date.now(), data }).catch(() => {});
      return data;
    } catch { return cached?.data || null; }
  })();
  mem.set(setId, p);
  return p;
}

/** the figures of one card from a line: { normal, reverse } with trend/avg1/avg7/avg30/low and the fair price */
export function cmFigures(line) {
  if (!line) return null;
  const f = (t, a1, a7, a30, lo) => ({ trend: t, avg1: a1, avg7: a7, avg30: a30, low: lo, fair: t || median([a7, a30]) || 0 });
  return { id: line[0], normal: f(line[1], line[2], line[3], line[4], line[5]), reverse: f(line[6], line[7], line[8], line[9], line[10]) };
}
const setOf = id => id.slice(0, id.lastIndexOf("-"));

/** puts the Cardmarket prices on the cards of a loaded extension (in place); true when a price changed */
export async function applyCmPrices(res) {
  const groups = new Map();
  for (const c of res.cards) if (!c.linked && !c.hint) { const s = setOf(c.id); (groups.get(s) || groups.set(s, []).get(s)).push(c); }
  let changed = false, at = "";
  for (const [sid, cards] of groups) {
    const data = await cmSet(sid); if (!data) continue;
    at = data.at || at;
    for (const c of cards) {
      const num = c.src || c.id.slice(c.id.lastIndexOf("-") + 1);
      const f = cmFigures(data.c[num]);
      if (!f) {
        // no Cardmarket line any more: back to TCGdex's price (or reload the card if it was lost)
        if (c.cm) { if (c.pT0 != null) { c.p = c.pT0; c.ph = c.phT0; } else c.ok = 0; delete c.cm; changed = true; }
        continue;
      }
      if (c.pT0 == null && !c.cm) { c.pT0 = c.p; c.phT0 = c.ph; }
      const p = f.normal.fair, ph = f.reverse.fair;
      if (p !== c.p || ph !== c.ph) changed = true;
      c.p = p; c.ph = ph; c.cm = f.id;
    }
  }
  res.info.cmAt = at || res.info.cmAt;
  res.info.cmGot = Date.now(); res.info.cmV = CM_V;
  return changed;
}
