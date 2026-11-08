import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("../src/lib/storage.js", () => { const m = new Map(); return { idb: { get: async k => m.get(k), set: async (k, v) => m.set(k, v) } }; });
import { applyAltPrices, numKey, pickPrice } from "../src/data/altprice.js";

describe("second price source", () => {
  it("numbers: 045 and 45 are the same card, RC29 stays RC29", () => {
    expect(numKey("045")).toBe("45"); expect(numKey("RC29")).toBe("RC29"); expect(numKey("tg05")).toBe("TG05");
  });
  it("keeps TCGdex when both sources agree, switches when they are far apart", () => {
    expect(pickPrice(10, 12, 0)).toBe(null);
    expect(pickPrice(3.59, 88, 0)).toBe(88);                 // Pikachu RC29: TCGdex on the wrong product
    expect(pickPrice(3.59, 88, 70)).toBe(88);
    expect(pickPrice(90, 4, 75)).toBe(null);                 // the second source is the wrong one: TCGplayer sides with TCGdex
    expect(pickPrice(0.1, 0.4, 0)).toBe(null);               // cents: no doubt worth having
    expect(pickPrice(0, 5, 0)).toBe(5);
  });
  beforeEach(() => {
    globalThis.fetch = vi.fn(async url => {
      const json = url.includes("/sets?") ? { data: [{ id: "g1", ptcgoCode: "GEN" }] }
        : { data: [{ id: "g1-RC29", number: "RC29", cardmarket: { updatedAt: "2026/11/08", prices: { trendPrice: 88.93, avg1: 77, avg7: 73.89, avg30: 98.35, lowPrice: 30 } }, tcgplayer: { prices: { holofoil: { market: 79.74 } } } },
                   { id: "g1-1", number: "1", cardmarket: { prices: { trendPrice: 0.3, avg7: 0.25, avg30: 0.28 } } }] };
      return { ok: true, json: async () => json };
    });
  });
  it("corrects the cards of a loaded extension", async () => {
    const res = { info: { id: "g1", abbr: "GEN" }, cards: [{ id: "g1-RC29", n: "RC29", p: 3.59, ph: 0 }, { id: "g1-001", n: "001", p: 0.27, ph: 0.5 }] };
    expect(await applyAltPrices(res)).toBe(true);
    expect(res.cards[0]).toMatchObject({ p: 88.93, pTd: 3.59 });
    expect(res.cards[1].p).toBe(0.27);
  });
});
