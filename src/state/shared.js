/* Mutable state shared between modules (ES module bindings are read-only for importers). */
export const S = {
  /** the whole collection: { cards: { [cardId]: { s: setId, v: { normal: n, reverse: n, ... }, d: dexIds } }, products, updated } */
  COL: null,
  /** the set currently open (or a stub { data: { info } } while a card sheet is open from elsewhere) */
  CUR: null,
  /** series index from TCGdex, newest first */
  SERIES: null
};
