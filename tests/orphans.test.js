import { describe, it, expect, vi } from "vitest";
vi.mock("../src/lib/ui.js", () => ({ toast() {} }));
const { S } = await import("../src/state/shared.js");
const C = await import("../src/state/collection.js");
const { shownVariants } = await import("../src/features/variants.js");

describe("a copy saved under a version the card no longer has", () => {
  it("holo-only Mewtwo-EX saved as normal: moved to holo", () => {
    S.COL = { cards: { "bw4-98": { s: "bw4", v: { normal: 1 } } } };
    C.fixOrphans([{ id: "bw4-98", setId: "bw4", v: ["holo"] }]);
    expect(S.COL.cards["bw4-98"].v).toEqual({ holo: 1 });
  });
  it("guessed versions or several versions: left alone, but shown on the card page", () => {
    S.COL = { cards: { "me06-010": { s: "me06", v: { normal: 1 } }, "sv1-1": { s: "sv1", v: { holo: 2 } } } };
    C.fixOrphans([{ id: "me06-010", setId: "me06", v: ["holo"], vg: 1 }, { id: "sv1-1", setId: "sv1", v: ["normal", "reverse"] }]);
    expect(S.COL.cards["me06-010"].v).toEqual({ normal: 1 });
    expect(shownVariants({ id: "sv1-1", v: ["normal", "reverse"] })).toEqual(["normal", "reverse", "holo"]);
  });
});
