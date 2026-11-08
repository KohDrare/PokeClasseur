/* Corrections on top of TCGdex, so the app matches Pokécardex:
   - sets shown as one (30ᵉ Anniversaire + its Collection Classique),
   - promo cards TCGdex does not list yet (names checked on Pokécardex, Dexocard and TCG Collector),
   - French scans from Pokécardex when TCGdex has no picture.
   Bump PATCH_V whenever this file changes: every patched set is then reloaded once. */
import { DEX_NAMES } from "./dex-names.js";
import { PCX } from "./pokecardex-map.js";

export const PATCH_V = 10;
export const SCANS = "https://pokecardex-scans.b-cdn.net/sets/";

/* ---------- sets merged into another one ---------- */
// the 30 "Collection Classique" reprints are numbered C01–C30 inside 30ᵉ Anniversaire, like on the cards
export const MERGED = { "30th": { from: "30th-c", label: "Collection Classique", prefix: "C" } };
export const HIDDEN_SETS = new Set(Object.values(MERGED).map(m => m.from));
export const mergedInto = setId => Object.keys(MERGED).find(k => MERGED[k].from === setId) || null;

/* ---------- cards missing from TCGdex ---------- */
// en: TCGdex has the card in English only (details taken from there, French name from here)
const P = (n, name, extra = {}) => ({ n, name, ...extra });
export const EXTRA = {
  // the three "RGB" Mew of the 30ᵉ Anniversaire. Ids are TCGdex's own (30th-R…), so once TCGdex lists them they are not doubled.
  "30th": [
    P("R", "Mew", { r: "RGB Rare", dx: [151] }), P("G", "Mew", { r: "RGB Rare", dx: [151] }), P("B", "Mew", { r: "RGB Rare", dx: [151] })
  ],
  mep: [
    P("089", "Méga-Zeraora-ex"), P("090", "Méga-Darkrai-ex"), P("091", "Méga-Dracolosse-ex"),
    P("092", "Hôtel « Au paradis des Pokémon »", { cat: "Dresseur" }), P("093", "Pikachu"),
    P("094", "Noadkoko d'Alola"), P("095", "Lucario"), P("096", "Sulfura"), P("097", "Artikodin"), P("098", "Électhor"),
    P("099", "Amphinobi-ex"), P("100", "Nymphali-ex"), P("101", "Nidorina"), P("102", "Victini"), P("103", "Zeraora"),
    P("104", "Mewtwo"), P("105", "Mew"), P("106", "Métamorph"), P("107", "Pikachu-ex"), P("108", "Mentali-ex"),
    P("109", "Pikachu-ex"), P("110", "Noctali-ex"), P("111", "Maskadra"), P("112", "Maganon"), P("113", "Amovénus"),
    P("114", "Ékaïser"), P("115", "Fluvetin"), P("116", "Otaria"), P("117", "Kyogre"),
    P("120", "Fanfare de Fête", { cat: "Dresseur" })
  ],
  svp: [
    P("085", "Pikachu au chapeau de feutre gris", { en: 1 }), P("102", "Mystherbe", { en: 1 }),
    P("213", "Aligatueur", { en: 1 }), P("214", "Pikachu", { en: 1 }), P("215", "Salarsen-ex", { en: 1 })
  ],
  swshp: [
    P("SWSH074", "Pikachu Livraison Spéciale", { en: 1 }), P("SWSH075", "Dracaufeu Livraison Spéciale", { en: 1 }),
    P("SWSH177", "Keunotor Livraison Spéciale", { en: 1 }), P("SWSH303", "Bulbizarre", { en: 1 }),
    P("SWSH304", "Arcanin", { en: 1 }), P("SWSH305", "Amphinobi", { en: 1 })
  ]
};
/* the "Black Star Promo" sets of each era, gathered by the "Promos" button on the home page */
export const PROMO_SETS = new Set(["mep", "svp", "swshp", "smp", "xyp", "bwp", "hgssp", "dpp", "np", "basep", "wp"]);
/* fixes for single cards, whoever lists them (TCGdex or the list above): printed number, Pokécardex scan, order */
export const CARD_FIX = {
  "30th-R": { n: "R/RGB", src: "R", scan: 189, order: 1 },
  "30th-G": { n: "G/RGB", src: "G", scan: 190, order: 2 },
  "30th-B": { n: "B/RGB", src: "B", scan: 191, order: 3 }
};
/* ids used by an earlier version of the app, moved to the right card in the collection */
export const RENAMED = { "30th-RGB-R": "30th-R", "30th-RGB-G": "30th-G", "30th-RGB-B": "30th-B" };

/* ---------- promos sold with a set's products ----------
   Shown at the end of that set (with the "Promo" rarity filter); the card itself stays in its promo set,
   so checking it in one place checks it in the other. Products from Bulbapedia, TCG Crew and Thornberry Media. */
const B = "Coffret Combat & Construction / avant-première", B1 = "Blister 1 booster", B3 = "Blister 3 boosters", ETB = "Coffret Dresseur d'élite";
const L = (from, to, prod) => Array.from({ length: to - from + 1 }, (_, i) => [String(from + i).padStart(3, "0"), prod]);
export const LINKED = {
  me01: [...L(1, 4, B), ...L(5, 6, B1), ...L(7, 8, B3), ["009", ETB + " (Méga-Gardevoir)"], ["010", ETB + " (Méga-Lucario)"]],
  me02: [...L(14, 17, B), ...L(18, 19, B1), ...L(20, 21, B3), ["022", ETB]],
  "me02.5": [["031", ETB], ["032", "Collection Poster Premium (Méga-Gardevoir)"], ["033", "Collection Poster Premium (Méga-Lucario)"],
    ["034", "Coffret Méga-Méganium-ex / Pokébox"], ["035", "Coffret Méga-Roitiflam-ex / Pokébox"], ["036", "Coffret Méga-Aligatueur-ex / Pokébox"]],
  me03: [...L(64, 67, B), ["068", B1], ["069", B3], ["070", ETB]],
  me04: [...L(74, 77, B), ["078", B1], ["079", B3], ["080", ETB]],
  me05: [...L(82, 85, B), ["086", B1], ["087", B3], ["088", ETB]],
  // Règne Delta: the 4 avant-première promos (one per kit), blister 1 booster, tripack, ETB (Kyogre illustration rare)
  me06: [...L(111, 114, "Kit d'avant-première / Coffret Combat & Construction"), ["115", B1], ["116", "Tripack (blister 3 boosters)"], ["117", ETB]],
  "30th": [["094", "Collection autocollant (selon l'exemplaire)"], ["095", "Collection autocollant (selon l'exemplaire)"],
    ...L(96, 98, "Collection poster"), ["099", "Coffret / Boîte 30ᵉ Anniversaire"], ["100", "Coffret / Boîte 30ᵉ Anniversaire"],
    ["101", ETB], ["102", "Deck Combat (Mentali-ex)"], ["103", "Deck Combat (Noctali-ex)"],
    ["104", "Collection avec figurine (Mewtwo)"], ["105", "Collection avec figurine (Mew)"], ["106", "Collection Premium Métamorph"],
    ...L(107, 110, "Collection Ultra-Premium")]
};
export const extraCount = setId => (EXTRA[setId] || []).length;

/* ---------- French scans from Pokécardex ---------- */
// Collection Classique: Pokécardex files them as 30ᵉ Anniversaire n° 159 to 188, in the order of the official list
const CLASSIC_30 = { "014": 159, "001": 160, "005": 161, "015": 162, "007": 163, "024": 164, "029": 165, "002": 166, "006": 167, "025": 168,
  "003": 169, "022": 170, "010": 171, "011": 172, "018": 173, "019": 174, "020": 175, "021": 176, "016": 177, "004": 178,
  "023": 179, "009": 180, "017": 181, "013": 182, "008": 183, "028": 184, "012": 185, "026": 186, "027": 187, "030": 188 };
// plain numbers, or the promo prefixes (SM01, SWSH074, HGSS01…); other prefixes (TG, GG, SV, CC…) are numbered differently there
const NUM = /^(?:SM|SWSH|XY|BW|HGSS|DP)?0*(\d+)$/i;
export function scanBase(setId, localId, scan) {
  const fix = CARD_FIX[`${setId}-${localId}`];
  if (fix && !scan) scan = fix.scan;
  if (scan && PCX[setId]) return `${SCANS}${PCX[setId]}/FR/${scan}`;
  if (setId === "30th-c") return CLASSIC_30[localId] ? `${SCANS}30C/FR/${CLASSIC_30[localId]}` : "";
  const code = PCX[setId], m = NUM.exec(localId || "");
  return code && m ? `${SCANS}${code}/FR/${+m[1]}` : "";
}
export const isScan = base => !!base && base.startsWith(SCANS);

/* Pokédex numbers from a French card name ("Méga-Dracaufeu X-ex" → 6) */
const plain = t => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const DEX_INDEX = new Map(DEX_NAMES.map((n, i) => [plain(n), i + 1]));
export function dexFromName(name) {
  const base = (name || "").replace(/^Méga-/, "").replace(/[- ](ex|EX|GX|V|VMAX|VSTAR|LÉGENDE|TURBO|G)$/, "")
    .replace(/ [XY]$/, "").replace(/ d'(Alola|Galar|Hisui|Paldea)$/, "").replace(/ (obscur|brillant|Chaleur|Lavage|Froid|Hélice|Tonte)$/, "").trim();
  const one = DEX_INDEX.get(plain(base));
  if (one) return [one];
  const two = base.split(/ & | et /).map(p => DEX_INDEX.get(plain(p.trim()))).filter(Boolean);
  return two.length > 1 ? two : [];
}

/* ---------- sets announced but not on TCGdex yet ----------
   Shown with the cards already revealed; as soon as TCGdex publishes the set, its data replaces this list
   (card ids follow TCGdex's pattern, so cards checked here stay checked). */
const C = "Commune", U = "Peu Commune", R = "Rare", RR = "Double rare", IR = "Illustration rare", UR = "Ultra Rare",
  SIR = "Illustration spéciale rare", MHR = "Méga Hyper Rare";
const T = (n, name, r, cat = "Pokémon") => ({ n, name, r, cat });
export const UPCOMING = {
  // Règne Delta (ME06, Delta Reign) — sorti le 6 novembre 2026 : 103 cartes + 38 secrètes = 141.
  // Liste française complète (pika-collect.fr), recoupée avec la liste anglaise (Bill's Archive, TCG Watchtower)
  // et les scans français de Pokécardex (code DLR). Remplacée par TCGdex dès qu'il publie l'extension.
  me06: {
    info: { id: "me06", name: "Règne Delta", logo: "logos/me06", serie: { id: "me", name: "Méga-Évolution" }, date: "2026-11-06", abbr: "DLR", official: 103, total: 141 },
    cards: [
      T("001", "Scarhino", C), T("002", "Arakdo", C), T("003", "Maskadra", C), T("004", "Cacnea", C), T("005", "Cacturne", R),
      T("006", "Apitrini", C), T("007", "Apireine", C), T("008", "Shaymin", U), T("009", "Viridium", U), T("010", "Sovkipou", C),
      T("011", "Méga-Sarmuraï-ex", RR), T("012", "Poussacha", C), T("013", "Matourgeon", U), T("014", "Miascarade-ex", RR), T("015", "Olivini", C),
      T("016", "Olivado", C), T("017", "Arboliva", U), T("018", "Caninos", C), T("019", "Arcanin", R), T("020", "Magmar", U),
      T("021", "Maganon", R), T("022", "Chartor", C), T("023", "Motisma Chaleur-ex", RR), T("024", "Aflamanoir", C), T("025", "Démanta", C),
      T("026", "Kyogre", R), T("027", "Viskuse", C), T("028", "Moyade", U), T("029", "Froussardine-ex", RR), T("030", "Élektek", C),
      T("031", "Élekable", U), T("032", "Voltali", U), T("033", "Raikou-ex", RR), T("034", "Motisma", C), T("035", "Fulguris", U),
      T("036", "Wattapik", C), T("037", "Pohm", C), T("038", "Pohmotte", C), T("039", "Pohmarmotte", U), T("040", "Zapétrel", C),
      T("041", "Fulgulairo", U), T("042", "Miraidon", U), T("043", "Soporifik", C), T("044", "Hypnomade", C), T("045", "Giratina", R),
      T("046", "Gringolem", C), T("047", "Méga-Golemastoc-ex", RR), T("048", "Amovénus", U), T("049", "Sabelette", C), T("050", "Sablaireau", C),
      T("051", "Onix", C), T("052", "Steelix", R), T("053", "Groudon", R), T("054", "Démétéros", U), T("055", "Nidoran♀", C),
      T("056", "Nidorina", C), T("057", "Nidoqueen", R), T("058", "Mimigal", C), T("059", "Migalos", C), T("060", "Ténéfix", C),
      T("061", "Carvanha", C), T("062", "Sharpedo", C), T("063", "Darkrai", U), T("064", "Chacripan", C), T("065", "Léopardus", C),
      T("066", "Zorua", C), T("067", "Zoroark-ex", RR), T("068", "Sepiatop", C), T("069", "Méga-Sépiatroce-ex", RR), T("070", "Morpeko", U),
      T("071", "Zarude", U), T("072", "Drakkarmin", U), T("073", "Bébécaille", C), T("074", "Écaïd", C), T("075", "Ékaïser", R),
      T("076", "Motorizard", C), T("077", "Tauros", C), T("078", "Évoli", C), T("079", "Cadoizo", U), T("080", "Azurill", C),
      T("081", "Tylton", C), T("082", "Altaria", R), T("083", "Kecleon", C), T("084", "Méga-Rayquaza-ex", RR), T("085", "Boréas", U),
      T("086", "Passerouge", C), T("087", "Braisillon", C), T("088", "Flambusard-ex", RR), T("089", "Millepertuis", U, "Dresseur"), T("090", "Lanterne Aventure", U, "Dresseur"),
      T("091", "Veste Personnalisée", U, "Dresseur"), T("092", "Engouement de la MC", C, "Dresseur"), T("093", "Cendro", U, "Dresseur"), T("094", "Pyroconduit Légendaire", U, "Dresseur"), T("095", "Pyroconduit Légendaire", U, "Dresseur"),
      T("096", "Sommet Légendaire", U, "Dresseur"), T("097", "Sommet Légendaire", U, "Dresseur"), T("098", "Fosse Légendaire", U, "Dresseur"), T("099", "Fosse Légendaire", U, "Dresseur"), T("100", "Chapeau Méga-Rayquaza", U, "Dresseur"),
      T("101", "Boulette de Riz Savoureuse", C, "Dresseur"), T("102", "Entraînement de Lévy et Tatia", U, "Dresseur"), T("103", "Confiance d'Amaryllis", U, "Dresseur"), T("104", "Maskadra", IR), T("105", "Poussacha", IR),
      T("106", "Caninos", IR), T("107", "Maganon", IR), T("108", "Élekable", IR), T("109", "Wattapik", IR), T("110", "Amovénus", IR),
      T("111", "Groudon", IR), T("112", "Zorua", IR), T("113", "Sepiatop", IR), T("114", "Évoli", IR), T("115", "Azurill", IR),
      T("116", "Altaria", IR), T("117", "Kecleon", IR), T("118", "Méga-Sarmuraï-ex", UR), T("119", "Motisma Chaleur-ex", UR), T("120", "Froussardine-ex", UR),
      T("121", "Raikou-ex", UR), T("122", "Méga-Golemastoc-ex", UR), T("123", "Méga-Sépiatroce-ex", UR), T("124", "Flambusard-ex", UR), T("125", "Millepertuis", UR, "Dresseur"),
      T("126", "Lanterne Aventure", UR, "Dresseur"), T("127", "Veste Personnalisée", UR, "Dresseur"), T("128", "Engouement de la MC", UR, "Dresseur"), T("129", "Attrape-Pokémon", UR, "Dresseur"), T("130", "Entraînement de Lévy et Tatia", UR, "Dresseur"),
      T("131", "Confiance d'Amaryllis", UR, "Dresseur"), T("132", "Énergie Eau Pétillante", UR, "Énergie"), T("133", "Énergie Plante Croissante", UR, "Énergie"), T("134", "Énergie Feu Nitro", UR, "Énergie"), T("135", "Méga-Sarmuraï-ex", SIR),
      T("136", "Raikou-ex", SIR), T("137", "Méga-Golemastoc-ex", SIR), T("138", "Méga-Rayquaza-ex", SIR), T("139", "Millepertuis", SIR, "Dresseur"), T("140", "Confiance d'Amaryllis", SIR, "Dresseur"),
      T("141", "Méga-Rayquaza-ex", MHR)
    ]
  }
};
/* versions a card can have, from its rarity: commons, uncommons and trainers normal + reverse, rares holo + reverse,
   ex and secret rares holo only */
export const upcomingVariants = c => [RR, IR, UR, SIR, MHR].includes(c.r) ? ["holo"] : c.r === R ? ["holo", "reverse"] : ["normal", "reverse"];
