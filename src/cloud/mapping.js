/* Pure conversions between the local collection object and database rows.
   Kept free of DOM / network so it can be unit-tested. */
import { mergedInto } from "../data/set-patches.js";

/** collection → rows of `collection_items` (without user_id, which the database fills in).
    `ext`: the database has the columns of migration 0003 (condition, language, favourite, date added) */
export function colToItems(col, ext = false) {
  const rows = [];
  for (const [cardId, e] of Object.entries(col.cards || {})) {
    for (const [variant, qty] of Object.entries(e.v || {})) {
      if (!(qty > 0)) continue;
      const r = { card_id: cardId, variant, set_id: e.s || cardId.slice(0, cardId.lastIndexOf("-")), qty, dex_ids: e.d || [] };
      if (ext) Object.assign(r, { cond: e.c || null, lang: e.l || null, fav: !!e.f, added_at: e.t || null });
      rows.push(r);
    }
  }
  return rows;
}

/** collection → rows of `purchases` */
export function colToPurchases(col) {
  const rows = [];
  for (const [setId, list] of Object.entries(col.products || {})) {
    for (const p of list || []) {
      const qty = Math.max(1, p.qty | 0);
      const opened = p.opened != null ? p.opened : p.sealed === false ? qty : 0;
      rows.push({ id: p.id, set_id: setId, type: p.type || "autre", name: String(p.name || "").slice(0, 90), qty,
        opened: Math.min(qty, Math.max(0, opened | 0)), bpp: Math.max(0, Math.min(99, p.bpp | 0)), price: Math.max(0, +p.price || 0) });
    }
  }
  return rows;
}

/** database rows → collection object */
export function rowsToCol(items, purchases) {
  const col = { cards: {}, products: {}, updated: Date.now() };
  for (const r of items) {
    const e = (col.cards[r.card_id] ||= { s: mergedInto(r.set_id) || r.set_id, v: {} });
    e.v[r.variant] = r.qty;
    if (r.dex_ids?.length) e.d = r.dex_ids;
    if (r.cond) e.c = r.cond;
    if (r.lang) e.l = r.lang;
    if (r.fav) e.f = 1;
    if (r.added_at) e.t = Math.min(e.t || +r.added_at, +r.added_at);
  }
  for (const r of purchases) (col.products[r.set_id] ||= []).push({ id: r.id, type: r.type, name: r.name, qty: r.qty, opened: r.opened, bpp: r.bpp, price: +r.price || 0 });
  return col;
}

/** merge two collections: highest quantity wins per card/version, purchases are united by id (a wins on conflict) */
export function mergeCols(a, b) {
  const out = { cards: {}, products: {}, updated: Date.now() };
  for (const src of [b, a]) {
    for (const [id, e] of Object.entries(src.cards || {})) {
      const cur = (out.cards[id] ||= { s: e.s, v: {} });
      cur.s = e.s || cur.s;
      if (e.d?.length) cur.d = e.d;
      if (e.f) cur.f = 1;
      if (e.c) cur.c = e.c;
      if (e.l) cur.l = e.l;                                 // condition, language, favourite: synced once migration 0003 is applied
      if (e.t) cur.t = Math.min(cur.t || e.t, e.t);         // first added
      for (const [v, q] of Object.entries(e.v || {})) cur.v[v] = Math.max(cur.v[v] || 0, q);
    }
    for (const [sid, list] of Object.entries(src.products || {})) {
      const cur = (out.products[sid] ||= []);
      for (const p of list) { const i = cur.findIndex(x => x.id === p.id); if (i >= 0) cur[i] = p; else cur.push(p); }
    }
  }
  return out;
}

const itemKey = r => r.card_id + "|" + r.variant;

/** what must be sent so the database matches `next`, given what it held (`prev`) */
export function diffRows(prev, next, keyOf, same) {
  const before = new Map(prev.map(r => [keyOf(r), r]));
  const upserts = [], deletes = [];
  const seen = new Set();
  for (const r of next) { const k = keyOf(r); seen.add(k); const old = before.get(k); if (!old || !same(old, r)) upserts.push(r); }
  for (const [k, r] of before) if (!seen.has(k)) deletes.push(r);
  return { upserts, deletes };
}
const sameItem = (a, b) => a.qty === b.qty && a.set_id === b.set_id && (a.dex_ids || []).join() === (b.dex_ids || []).join()
  && (a.cond || null) === (b.cond || null) && (a.lang || null) === (b.lang || null) && !!a.fav === !!b.fav && +(a.added_at || 0) === +(b.added_at || 0);
const samePurchase = (a, b) => JSON.stringify({ ...a, price: +a.price }) === JSON.stringify({ ...b, price: +b.price });
export const diffItems = (prev, next) => diffRows(prev, next, itemKey, sameItem);
export const diffPurchases = (prev, next) => diffRows(prev, next, r => r.id, samePurchase);

/** three-way merge, row by row: what changed on this device since the last sync (`base`) wins,
    everything else follows the database (so a card removed on another device disappears here too) */
export function threeWay(base, local, remote, keyOf, same) {
  const B = new Map(base.map(r => [keyOf(r), r])), L = new Map(local.map(r => [keyOf(r), r])), R = new Map(remote.map(r => [keyOf(r), r]));
  const out = [];
  for (const k of new Set([...B.keys(), ...L.keys(), ...R.keys()])) {
    const b = B.get(k), l = L.get(k), r = R.get(k);
    const untouched = (!b && !l) || (b && l && same(b, l));
    const pick = untouched ? r : l;
    if (pick) out.push(pick);
  }
  return out;
}
export const mergeItems = (base, local, remote) => threeWay(base, local, remote, itemKey, sameItem);
export const mergePurchases = (base, local, remote) => threeWay(base, local, remote, r => r.id, samePurchase);
