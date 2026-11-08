import { describe, it, expect } from "vitest";
import { cmFigures } from "../src/data/cmprices.js";
describe("Cardmarket price guide", () => {
  it("fair price: middle of trend, 7- and 30-day averages; reverse apart", () => {
    const f = cmFigures([288538, 88.93, 77.47, 86.31, 105.14, 30, 26.04, 39.49, 27.61, 28.16, 0]);   // Pikachu RC29
    expect(f.normal.fair).toBe(88.93);
    expect(f.reverse.fair).toBe(27.61);
    expect(cmFigures(null)).toBe(null);
  });
});
