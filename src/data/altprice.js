/* Second source of Cardmarket prices, to catch the cards TCGdex links to the wrong Cardmarket product
   (Pikachu RC29 of Générations got 3,59 € instead of about 90 €: TCGdex points at another product).
   pokemontcg.io keeps its own link from each card to its Cardmarket page, with the same figures
   (trend, 1/7/30-day averages) plus the TCGplayer prices; when the two sources disagree a lot,
   the one that agrees with TCGplayer wins, or pokemontcg.io when there is nothing to compare with. */
import { idb } from "../lib/storage.js";
import { USD_EUR } from "./price-hints.js";

const API = "https://api.pokemontcg.io/v2";
const mem = new Map();
const median = a => { const v = a.filter(x => x > 0).sort((x, y) => x - y); if (!v.length) return 0; const m = v.length >> 1; return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2; };
export const numKey = n => (/^\d+$/.test(String(n)) ? String(+n) : String(n || "")).toUpperCase();

async function get(url) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 12000);
  try { const r = await fetch(url, { signal: ctl.signal }); if (!r.ok) throw new Error(r.status); return await r.json(); }
  finally { clearTimeout(t); }
}

/* pokemontcg.io names most sets like TCGdex without the zeros (sv08 → sv8, sv03.5 → sv3pt5) */
async function ptcgSet(setId, abbr) {
  if (abbr) {
    const r = await get(`${API}/sets?q=ptcgoCode:${encodeURIComponent(abbr)}&select=id,ptcgoCode`).catch(() => null);
    if (r?.data?.length === 1) return r.data[0].id;
  }
  const guess = setId.replace(/\.5$/, "pt5").replace(/^([a-z]+)0+(\d)/, "$1$2");
  const r = await get(`${API}/sets/${encodeURIComponent(guess)}?select=id`).catch(() => null);
  return r?.data?.id || null;
}

/* the figures of one card: { p, ph, tp } in euros (normal / reverse fair price, TCGplayer converted) */
function figures(c) {
  const cm = c.cardmarket?.prices || {};
  const p = median([cm.trendPrice, cm.avg7, cm.avg30]) || cm.averageSellPrice || 0;
  const ph = median([cm.reverseHoloTrend, cm.reverseHoloAvg7, cm.reverseHoloAvg30]) || 0;
  const tps = Object.entries(c.tcgplayer?.prices || {}).filter(([k]) => !/reverse|1st/i.test(k)).map(([, x]) => x?.market || x?.mid || 0).filter(x => x > 0);
  return { p: Math.round(p * 100) / 100, ph: Math.round(ph * 100) / 100, tp: tps.length ? Math.round(Math.max(...tps) * USD_EUR * 100) / 100 : 0,
    d: { trend: cm.trendPrice, avg1: cm.avg1, avg7: cm.avg7, avg30: cm.avg30, low: cm.lowPrice, rtrend: cm.reverseHoloTrend, ravg1: cm.reverseHoloAvg1, ravg7: cm.reverseHoloAvg7, ravg30: cm.reverseHoloAvg30, rlow: cm.reverseHoloLow }, at: c.cardmarket?.updatedAt || "" };
}

/** prices of a whole extension from pokemontcg.io: { number → figures }, or null (unknown set, offline…).
    Kept 3 days on this device. */
export function altSetPrices(setId, abbr) {
  if (mem.has(setId)) return mem.get(setId);
  const p = (async () => {
    const key = `alt1:${setId}`, cached = await idb.get(key).catch(() => null);
    if (cached && Date.now() - cached.at < (cached.map ? 3 : 1) * 864e5) return cached.map;
    let map = null;
    try {
      const pid = await ptcgSet(setId, abbr);
      if (pid) {
        map = {};
        for (let page = 1; page < 10; page++) {
          const r = await get(`${API}/cards?q=set.id:${encodeURIComponent(pid)}&select=id,number,cardmarket,tcgplayer&pageSize=250&page=${page}`);
          for (const c of r.data || []) map[numKey(c.number)] = figures(c);
          if ((r.data || []).length < 250) break;
        }
        if (!Object.keys(map).length) map = null;
      }
    } catch (e) { if (cached) return cached.map; console.warn("[prix] seconde source indisponible", e); return null; }
    await idb.set(key, { at: Date.now(), map }).catch(() => {});
    return map;
  })();
  mem.set(setId, p);
  return p;
}

/** which price to trust when TCGdex (cm) and pokemontcg.io (alt) disagree by more than 3×.
    `tp`: a TCGplayer price in euros to decide with. Returns null to keep TCGdex, else the price to use. */
export function pickPrice(cm, alt, tp) {
  if (!(alt > 0)) return null;
  if (!(cm > 0)) return alt;
  if (Math.max(cm, alt) < 2) return null;   // a few cents either way: not worth a doubt
  const r = cm / alt;
  if (r < 3 && r > 1 / 3) return null;
  if (tp > 0) return Math.abs(Math.log(alt / tp)) < Math.abs(Math.log(cm / tp)) ? alt : null;
  return alt;
}

/** corrects the prices of a loaded extension in place; returns true when something changed */
export async function applyAltPrices(res) {
  const sid = res?.info?.id; if (!sid) return false;
  const map = await altSetPrices(sid, res.info.abbr);
  res.info.altAt = Date.now();
  if (!map) return false;
  let changed = false;
  for (const c of res.cards) {
    if (c.linked || c.hint || c.id.slice(0, c.id.lastIndexOf("-")) !== sid) continue;
    const a = map[numKey(c.src || c.n)]; if (!a) continue;
    const base = c.pTd ?? c.p, baseH = c.phTd ?? c.ph;
    const p = pickPrice(base, a.p, a.tp), ph = pickPrice(baseH, a.ph, 0);
    const np = p ?? base, nph = ph ?? baseH;
    if (np !== c.p || nph !== c.ph) changed = true;
    if (p != null) { c.pTd = base; c.p = p; } else { delete c.pTd; c.p = base; }
    if (ph != null) { c.phTd = baseH; c.ph = ph; } else { delete c.phTd; c.ph = baseH; }
  }
  return changed;
}
