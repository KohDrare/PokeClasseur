import { it, expect } from "vitest";
import { dexFromName } from "../src/data/set-patches.js";
it("Pokédex number from the card name, also with the special hyphen of new cards", () => { expect(dexFromName("Raikou‑ex")).toEqual([243]); expect(dexFromName("Méga‑Rayquaza‑ex")).toEqual([384]); expect(dexFromName("Scarhino")).toEqual([214]); expect(dexFromName("Motisma Chaleur‑ex")).toEqual([479]); });
