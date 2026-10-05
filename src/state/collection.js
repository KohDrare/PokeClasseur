import { LS } from "../lib/storage.js";
import { toast } from "../lib/ui.js";
import { S } from "./shared.js";

export const COL_KEY = "pokeclasseur-collection-v1";
S.COL = LS.get(COL_KEY, { cards: {}, updated: 0 });
if (!S.COL.cards) S.COL = { cards: {}, updated: 0 };
export function saveCol() { S.COL.updated = Date.now(); if (!LS.set(COL_KEY, S.COL)) toast("Sauvegarde impossible sur cet appareil"); }
export const qtyOf = (id, v) => S.COL.cards[id]?.v?.[v] || 0;
export const ownedAny = id => { const v = S.COL.cards[id]?.v; return !!v && Object.values(v).some(n => n > 0); };
export function setQty(card, variant, n) {
  n = Math.max(0, Math.min(99, n));
  const e = S.COL.cards[card.id] || { s: card.setId, v: {} };
  e.s = card.setId;
  if (card.ok) e.d = card.dx || [];
  if (n) e.v[variant] = n; else delete e.v[variant];
  if (Object.keys(e.v).length) S.COL.cards[card.id] = e; else delete S.COL.cards[card.id];
  saveCol();
}
export function ownedBySet() {
  const m = {};
  for (const e of Object.values(S.COL.cards)) {
    if (!Object.values(e.v || {}).some(n => n > 0)) continue;
    (m[e.s] ||= { cards: 0, versions: 0 });
    m[e.s].cards++;
    m[e.s].versions += Object.values(e.v).filter(n => n > 0).length;
  }
  return m;
}
