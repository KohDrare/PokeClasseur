import { rarity, symSVG } from "./rarity.js";
import { esc } from "../lib/core.js";
import { S } from "../state/shared.js";

/* ---------- variants ---------- */
export const VARIANT_ORDER = ["normal", "holo", "firstEdition", "reverse", "wPromo"];
export const VARIANT_LABEL = { normal: "Normale", holo: "Holo", reverse: "Reverse", firstEdition: "1re édition", wPromo: "Promo W" };
export const variantsOf = c => c.v && c.v.length ? c.v : ["normal"];
export const mainVariant = c => variantsOf(c)[0];
/* which foil to show for a card: "holo", "rev" or "" */
/* special rares (ex, Méga-ex, full art, illustrations, gold…) are named precisely and get no generic holo shine */
export const PLAIN_RAR = new Set(["", "commune", "peu commune", "rare", "holo rare", "rare holo", "promo", "sans rareté", "aucune"]);
export function cardKind(c) {
  const n = (c.name || "").trim();
  if (/^m[ée]ga[- ].*-ex$/i.test(n)) return "Méga-ex";
  if (/[- ]ex$/.test(n)) return "Pokémon-ex";
  if (/[- ]EX$/.test(n)) return /^M[- ]/.test(n) ? "Méga-EX" : "Pokémon-EX";
  if (/&.*[- ]GX$/.test(n)) return "TAG TEAM GX";
  if (/[- ]GX$/i.test(n)) return "Pokémon-GX";
  if (/ VMAX$/.test(n)) return "Pokémon VMAX";
  if (/ VSTAR$/.test(n)) return "Pokémon VSTAR";
  if (/ V-UNION$/.test(n)) return "V-UNION";
  if (/ V$/.test(n)) return "Pokémon V";
  if (/TURBO$|BREAK$/i.test(n)) return "Pokémon TURBO";
  if (/LV\.?X$/i.test(n)) return "Niveau X";
  if (/ (Prime|LÉGENDE)$/.test(n)) return "";
  return "";
}
export function isSecretNo(c) {
  const off = (S.CUR?.data?.info?.official) || 0;
  return /^\d+$/.test(c.n || "") && off && +c.n > off;
}
export function isSpecial(c) {
  const l = (c.r || "").toLowerCase();
  return !!cardKind(c) || !PLAIN_RAR.has(l);
}
/* full precise name, e.g. "Méga-ex · Illustration spéciale rare" */
export function rareName(c) {
  const l = (c.r || "").toLowerCase(), k = cardKind(c), cat = c.cat === "Dresseur" ? "Dresseur" : c.cat === "Énergie" ? "Énergie" : "";
  const withK = base => k ? `${k} · ${base}` : base;
  switch (l) {
    case "double rare": return withK("Double rare");
    case "ultra rare": return `Full Art ${k || cat || "Pokémon"} · Ultra Rare`;
    case "illustration rare": return "Illustration rare";
    case "illustration spéciale rare": return k ? `${k} · Illustration spéciale rare` : cat ? `${cat} · Illustration spéciale rare` : "Illustration spéciale rare";
    case "hyper rare": return withK("Hyper Rare (Gold)");
    case "méga hyper rare": return "Méga Hyper Rare (Gold)";
    case "chromatique ultra rare": return withK("Chromatique Ultra Rare");
    case "shiny rare": case "shiny rare v": case "shiny rare vmax": return withK("Chromatique Rare");
    case "magnifique rare": return isSecretNo(c) ? withK("Rare Secrète") : withK("Rare Magnifique");
    case "magnifique": return "Rare Magnifique";
    case "dresseur full art": return "Full Art Dresseur";
    case "holo rare v": case "holo rare vmax": case "holo rare vstar": return k || c.r;
    case "radieux rare": return "Pokémon Radieux";
    case "high-tech rare": return "HIGH-TECH (ACE SPEC) · Rare";
    case "rare prime": return "Pokémon Prime";
    case "légende": return "Pokémon LÉGENDE";
    case "rare holo lv.x": return "Niveau X · Rare Holo";
    case "rare noir blanc": return "Rare Noir & Blanc";
    case "pikachu rare": return "Pikachu Rare";
    case "futuristic rare": return "Rare Futuriste";
    case "collection classique": return "Collection Classique";
    case "couronne": return "Couronne (Gold)";
  }
  return k ? `${k}${c.r && !PLAIN_RAR.has(l) ? " · " + c.r : ""}` : (c.r || "Holo");
}
/* short version for small tags */
export function rareShort(c) {
  const l = (c.r || "").toLowerCase(), k = cardKind(c);
  if (l === "double rare") return k || "Double rare";
  if (l === "ultra rare") return "Full Art";
  if (l === "illustration rare") return "Illustration rare";
  if (l === "illustration spéciale rare") return "Illustration spéciale";
  if (l === "hyper rare" || l === "couronne") return "Gold";
  if (l === "méga hyper rare") return "Méga Hyper Rare";
  if (l === "magnifique rare") return isSecretNo(c) ? "Secrète" : "Magnifique";
  if (l.startsWith("chromatique") || l.startsWith("shiny")) return "Chromatique";
  if (l === "dresseur full art") return "Full Art";
  if (l === "high-tech rare") return "HIGH-TECH";
  return k || c.r || "Holo";
}
export const variantLabel = (c, v) => v === "holo" && isSpecial(c) ? rareName(c) : VARIANT_LABEL[v];
export const variantShort = (c, v) => v === "holo" && isSpecial(c) ? rareShort(c) : VARIANT_LABEL[v];
export function foilOf(c, v) {
  v = v || mainVariant(c);
  if (v === "reverse") return "rev";
  return v === "holo" && !isSpecial(c) ? "holo" : "";
}
/* effects swapped on request: reverse cards use the rainbow sheen, holo cards the frame foil */
export const FX_STYLE = { rev: "holo", holo: "spark" };  /* same rainbow sheen for both; only the shining area differs (see m-rev / m-holo) */
export const fxHTML = f => f ? `<span class="fx f-${FX_STYLE[f] || f}${f === "rev" ? " m-rev" : " m-holo"}"></span>` : "";  /* m-rev keeps the artwork matte on reverse cards */
export const ftagHTML = f => f ? `<span class="ftag">${f === "rev" ? "Reverse" : "Holo"}</span>` : "";
export const badgeHTML = (c, v) => { const f = foilOf(c, v); if (f) return ftagHTML(f); if ((v || mainVariant(c)) === "holo" && isSpecial(c)) return `<span class="ftag rare">${symSVG(rarity(c.r).sym)}${esc(rareShort(c))}</span>`; return ""; };
/* pointer tracking for every foil card */
document.addEventListener("pointermove", e => {
  const el = e.target.closest?.(".cardimg,.slot.has,.holo"); if (!el || !el.querySelector(".fx")) return;
  const b = el.getBoundingClientRect();
  el.style.setProperty("--mx", ((e.clientX - b.left) / b.width * 100).toFixed(1) + "%");
  el.style.setProperty("--my", ((e.clientY - b.top) / b.height * 100).toFixed(1) + "%");
}, { passive: true });
export const priceOf = (c, v) => (v === "reverse" ? c.ph : c.p) || 0;
export const eur = n => n ? n.toLocaleString("fr-BE", { style: "currency", currency: "EUR", minimumFractionDigits: n < 1000 ? 2 : 0, maximumFractionDigits: n < 1000 ? 2 : 0 }) : "–";
