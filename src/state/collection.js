import { RENAMED, mergedInto } from "../data/set-patches.js";
import { LS } from "../lib/storage.js";
import { toast } from "../lib/ui.js";
import { S } from "./shared.js";

export const COL_KEY = "pokeclasseur-collection-v1";
S.COL = LS.get(COL_KEY, { cards: {}, updated: 0 });
if (!S.COL.cards) S.COL = { cards: {}, updated: 0 };
/* cards of a set now shown inside another one (Collection Classique → 30ᵉ Anniversaire) */
export function fixMergedSets(col) {
  let n = 0;
  for (const e of Object.values(col.cards || {})) { const to = mergedInto(e.s); if (to) { e.s = to; n++; } }
  // card ids from an earlier version of the app
  for (const [from, to] of Object.entries(RENAMED)) {
    const e = col.cards?.[from]; if (!e) continue;
    const t = (col.cards[to] ||= { s: e.s, v: {} });
    for (const [v, q] of Object.entries(e.v || {})) t.v[v] = Math.max(t.v[v] || 0, q);
    delete col.cards[from]; n++;
  }
  return n;
}
if (fixMergedSets(S.COL)) LS.set(COL_KEY, S.COL);
export function saveCol() {
  S.COL.updated = Date.now();
  if (!LS.set(COL_KEY, S.COL)) toast("Sauvegarde impossible sur cet appareil");
  dispatchEvent(new CustomEvent("collection:changed"));   // the cloud sync listens to this
}
export const qtyOf = (id, v) => S.COL.cards[id]?.v?.[v] || 0;
export const ownedAny = id => { const v = S.COL.cards[id]?.v; return !!v && Object.values(v).some(n => n > 0); };
export function setQty(card, variant, n) {
  n = Math.max(0, Math.min(99, n));
  const e = S.COL.cards[card.id] || { s: card.setId, v: {}, t: Date.now() };
  e.s = card.setId;
  if (card.ok) e.d = card.dx || [];
  if (n) e.v[variant] = n; else delete e.v[variant];
  if (Object.keys(e.v).length) S.COL.cards[card.id] = e; else delete S.COL.cards[card.id];
  saveCol();
}
/* favourite cards, for "Par favoris" in the collection */
export const isFav = id => !!S.COL.cards[id]?.f;
export function setFav(id, on) { const e = S.COL.cards[id]; if (!e) return; if (on) e.f = 1; else delete e.f; saveCol(); }
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
