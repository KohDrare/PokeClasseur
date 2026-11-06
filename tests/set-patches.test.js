import { describe, expect, it } from "vitest";
import { EXTRA, dexFromName, mergedInto, scanBase } from "../src/data/set-patches.js";
import { fixMergedSets } from "../src/state/collection.js";
import { patchSeries } from "../src/data/tcgdex.js";

describe("set patches", () => {
  it("finds French scans on Pokécardex", () => {
    expect(scanBase("mep", "089")).toBe("https://pokecardex-scans.b-cdn.net/sets/MEP/FR/89");
    expect(scanBase("smp", "SM01")).toBe("https://pokecardex-scans.b-cdn.net/sets/PRSM/FR/1");
    expect(scanBase("swshp", "SWSH251")).toMatch(/PRSWSH\/FR\/251$/);
    expect(scanBase("30th-c", "001")).toMatch(/30C\/FR\/160$/);   // Dracaufeu
    expect(scanBase("swsh9tg", "TG01")).toBe("");                 // numbered differently there
  });
  it("guesses Pokédex numbers from French names", () => {
    expect(dexFromName("Méga-Dracaufeu X-ex")).toEqual([6]);
    expect(dexFromName("Noadkoko d'Alola")).toEqual([103]);
    expect(dexFromName("Pikachu et Zekrom GX")).toEqual([25, 644]);
    expect(dexFromName("Hôtel « Au paradis des Pokémon »")).toEqual([]);
  });
  it("lists every MEP promo up to 114", () => {
    const n = EXTRA.mep.map(x => +x.n);
    expect(n[0]).toBe(89);
    expect(n).toContain(114);
  });
  it("shows the Collection Classique inside 30ᵉ Anniversaire", () => {
    const series = [{ id: "me", sets: [{ id: "30th", total: 158 }, { id: "30th-c", total: 30 }, { id: "mep", total: 88 }] }];
    const out = patchSeries(series)[0].sets.filter(t => t.id !== "me06");   // me06 = announced set, tested below
    expect(out.map(t => t.id)).toEqual(["30th", "mep"]);
    expect(out[0].total).toBe(158 + 30 + 3);   // + Collection Classique + the RGB Mew (until the set is opened)
    expect(out[1].total).toBe(88 + EXTRA.mep.length);
    expect(mergedInto("30th-c")).toBe("30th");
    const col = { cards: { "30th-c-001": { s: "30th-c", v: { normal: 1 } }, "30th-001": { s: "30th", v: { normal: 1 } } } };
    expect(fixMergedSets(col)).toBe(1);
    expect(col.cards["30th-c-001"].s).toBe("30th");
  });
});

describe("promo symbol", () => {
  it("gives promo cards their own rarity filter", async () => {
    const { rarity } = await import("../src/features/rarity.js");
    expect(rarity("Promo").sym).toBe("promo");
    expect(scanBase("30th", "R")).toMatch(/30C\/FR\/189$/);
  });
});

describe("promos sold with a set", () => {
  it("links the Nuit Noire ETB promo (Zarude) and the 30th promos", async () => {
    const { LINKED, RENAMED } = await import("../src/data/set-patches.js");
    expect(LINKED.me05).toContainEqual(["088", "Coffret Dresseur d'élite"]);
    expect(LINKED["30th"].map(x => x[0])).toContain("101");
    const col = { cards: { "30th-RGB-R": { s: "30th", v: { holo: 1 } } } };
    fixMergedSets(col);
    expect(col.cards["30th-R"].v.holo).toBe(1);
    expect(col.cards["30th-RGB-R"]).toBeUndefined();
    expect(RENAMED["30th-RGB-B"]).toBe("30th-B");
  });
});

describe("Règne Delta before its release", () => {
  it("is added to the Méga-Évolution series while TCGdex does not have it", async () => {
    const { UPCOMING } = await import("../src/data/set-patches.js");
    const out = patchSeries([{ id: "me", sets: [{ id: "me05", total: 120 }] }])[0].sets;
    expect(out[0].id).toBe("me06");
    expect(out[0].name).toBe("Règne Delta");
    expect(UPCOMING.me06.cards.find(c => c.n === "084").name).toBe("Méga-Rayquaza-ex");
    expect(dexFromName("Méga-Rayquaza-ex")).toEqual([384]);
    // once TCGdex lists it, the announced version is not added twice
    const later = patchSeries([{ id: "me", sets: [{ id: "me06", total: 140 }, { id: "me05", total: 120 }] }])[0].sets;
    expect(later.filter(t => t.id === "me06")).toHaveLength(1);
  });
});
