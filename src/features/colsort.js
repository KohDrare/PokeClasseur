/* Sorting the cards of the collection (shared by "Ma collection" and the binder editor).
   items: { c, info, q (copies), val, unit (best price), no (number), date (set release) } */
import { rarity } from "./rarity.js";
import { isFav } from "../state/collection.js";

export const SORTS = [
  { k: "num", l: "Par numéro de carte", d: 1, i: '<rect x="4" y="3" width="13" height="17" rx="2"/><path d="M19 13v8M15.5 15.5h7M15.5 18.5h7"/>' },
  { k: "type", l: "Par type", d: 1, i: '<circle cx="12" cy="12" r="9"/><path d="m12 6 1.6 4.4L18 12l-4.4 1.6L12 18l-1.6-4.4L6 12l4.4-1.6z"/>' },
  { k: "rar", l: "Par rareté", d: -1, i: '<path d="M12 3 21 12 12 21 3 12z"/>' },
  { k: "qty", l: "Par nombre d'exemplaires", d: -1, i: '<rect x="4" y="3" width="13" height="17" rx="2"/><path d="M20 6v14a1 1 0 0 1-1 1H8"/>' },
  { k: "set", l: "Par extension", d: -1, i: '<rect x="5" y="2.5" width="14" height="19" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M5 12h4M15 12h4"/>' },
  { k: "price", l: "Par prix", d: -1, i: '<path d="M17 6.5A6.5 6.5 0 1 0 17 17.5"/><path d="M4 10h9M4 14h9"/>' },
  { k: "fav", l: "Par favoris", d: -1, i: '<path d="M6 3h12v18l-6-4-6 4z"/><path d="m12 7 1.1 2.3 2.5.3-1.8 1.8.4 2.5-2.2-1.2-2.2 1.2.4-2.5-1.8-1.8 2.5-.3z"/>' }
];
export const TYPES = ["Plante", "Feu", "Eau", "Électrique", "Psy", "Combat", "Obscurité", "Métal", "Dragon", "Fée", "Incolore"];
export const typeRank = c => { const t = (c.t || "").split(",")[0].trim(); const i = TYPES.indexOf(t); return i >= 0 ? i : c.cat === "Dresseur" ? 20 : c.cat === "Énergie" ? 21 : 19; };
export function sortItems(items, k, d) {
  const bySetNo = (a, b) => a.date.localeCompare(b.date) || a.info.id.localeCompare(b.info.id) || a.no - b.no || (a.c.n || "").localeCompare(b.c.n || "");
  const key = {
    num: (a, b) => d * bySetNo(a, b),
    set: (a, b) => d * (a.date.localeCompare(b.date) || a.info.id.localeCompare(b.info.id)) || a.no - b.no,
    type: (a, b) => d * (typeRank(a.c) - typeRank(b.c)) || a.c.name.localeCompare(b.c.name, "fr"),
    rar: (a, b) => d * (rarity(a.c.r).rank - rarity(b.c.r).rank) || b.unit - a.unit,
    qty: (a, b) => d * (a.q - b.q) || b.unit - a.unit,
    price: (a, b) => d * (a.unit - b.unit) || bySetNo(a, b),
    fav: (a, b) => d * (isFav(a.c.id) - isFav(b.c.id)) || b.unit - a.unit
  }[k] || ((a, b) => bySetNo(a, b));
  return [...items].sort(key);
}
