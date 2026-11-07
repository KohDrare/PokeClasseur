/* Pure conversions between the local collection object and database rows.
   Kept free of DOM / network so it can be unit-tested. */
import { mergedInto } from "../data/set-patches.js";

/** collection → rows of `collection_items` (without user_id, which the database fills in) */
export function colToItems(col) {
  const rows = [];
  for (const [cardId, e] of Object.entries(col.cards || {})) {
    for (const [variant, qty] of Object.entries(e.v || {})) {
      if (qty > 0) rows.push({ card_id: cardId, variant, set_id: e.s || cardId.slice(0, cardId.lastIndexOf("-")), qty, dex_ids: e.d || [] });
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
      if (e.l) cur.l = e.l;                                 // language of the copy (kept on this device)                                 // condition of the copy (kept on this device)                                   // favourite (kept on this device)
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
export const diffItems = (prev, next) => diffRows(prev, next, itemKey, (a, b) => a.qty === b.qty && a.set_id === b.set_id && (a.dex_ids || []).join() === (b.dex_ids || []).join());
export const diffPurchases = (prev, next) => diffRows(prev, next, r => r.id, (a, b) => JSON.stringify({ ...a, price: +a.price }) === JSON.stringify({ ...b, price: +b.price }));
