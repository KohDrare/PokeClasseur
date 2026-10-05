import { describe, it, expect } from "vitest";
import { rarity } from "../src/features/rarity.js";
import { isSpecial, rareName, rareShort, foilOf, eur } from "../src/features/variants.js";

const card = (o) => ({ id: "me05-001", n: "001", name: "Tropius", r: "Commune", cat: "Pokémon", v: ["normal", "reverse"], ...o });

describe("rarity symbols", () => {
  it("maps French rarity labels to the printed symbol", () => {
    expect(rarity("Commune").sym).toBe("circle");
    expect(rarity("Peu Commune").sym).toBe("diamond");
    expect(rarity("Double rare").sym).toBe("star2");
    expect(rarity("Illustration rare").sym).toBe("star-gold");
    expect(rarity("Méga Hyper Rare").sym).toBe("sparkle-gold");
  });
  it("orders rarities from common to rarest", () => {
    expect(rarity("Commune").rank).toBeLessThan(rarity("Ultra Rare").rank);
    expect(rarity("Illustration spéciale rare").rank).toBeLessThan(rarity("Méga Hyper Rare").rank);
  });
});

describe("special rares", () => {
  it("names ex / Méga-ex / full art precisely", () => {
    expect(rareName(card({ name: "Floramantis-ex", r: "Double rare" }))).toBe("Pokémon-ex · Double rare");
    expect(rareName(card({ name: "Méga-Darkrai-ex", r: "Illustration spéciale rare" }))).toBe("Méga-ex · Illustration spéciale rare");
    expect(rareName(card({ name: "Albia", r: "Ultra Rare", cat: "Dresseur" }))).toBe("Full Art Dresseur · Ultra Rare");
    expect(rareShort(card({ name: "Méga-Darkrai-ex", r: "Méga Hyper Rare" }))).toBe("Méga Hyper Rare");
  });
  it("only plain holos and reverses shine", () => {
    expect(isSpecial(card())).toBe(false);
    expect(foilOf(card(), "reverse")).toBe("rev");
    expect(foilOf(card({ r: "Rare", v: ["holo", "reverse"] }), "holo")).toBe("holo");
    expect(foilOf(card({ name: "Floramantis-ex", r: "Double rare", v: ["holo"] }), "holo")).toBe("");
  });
});

describe("prices", () => {
  it("formats euros the Belgian way", () => {
    expect(eur(0)).toBe("–");
    expect(eur(5.5).replace(/\s/g, " ")).toBe("5,50 €");
  });
});
