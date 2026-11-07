import { describe, expect, it } from "vitest";
import { codeScore, guessCards, makeVoter, parseScan, sameNumber } from "../src/scan/match.js";

const SETS = [
  { id: "me06", code: "DLR", official: 103, total: 141, date: "2026-11-06" },
  { id: "me05", code: "PBL", official: 84, total: 120, date: "2026-07-17" },
  { id: "me01", code: "MEG", official: 132, total: 188, date: "2025-09-26" },
  { id: "sv01", code: "SVI", official: 198, total: 258, date: "2023-03-31" },
  { id: "sv08.5", code: "PRE", official: 131, total: 180, date: "2025-01-17" },
  { id: "sv08", code: "SSP", official: 191, total: 252, date: "2024-11-08" },
  { id: "mep", code: "MEP", official: 0, total: 120, date: "2025-09-26" },
  { id: "30th", code: "30C", official: 128, total: 161, date: "2026-09-16" },
  { id: "xy1", code: "XY", official: 146, total: 146, date: "2014-02-05" }
];
const best = text => guessCards(parseScan(text), SETS)[0];

describe("scanner matching", () => {
  it("reads what the text recognition really returned on card photos", () => {
    expect(best("M 10 DIR 084/103 9 TP")).toMatchObject({ setId: "me06", num: 84 });          // DLR read as DIR
    expect(best("R JV FSS Y X2 / NG 7 J CIEE 141/103 C2025")).toMatchObject({ setId: "me06", num: 141 });
    expect(best("H S6EMG 0 0 050/132")).toMatchObject({ setId: "me01", num: 50 });
    expect(best("RN LC OOM PL 088/084 02026 P MN N")).toMatchObject({ setId: "me05", num: 88 });
    expect(best("4 4 RG J P A K PRE 150/ 131 18 40")).toMatchObject({ setId: "sv08.5", num: 150 });
    expect(best("V J P22 3 P A ED 180/191 J U S 02024")).toMatchObject({ setId: "sv08", num: 180 });
    expect(best("F X22 R 1 J SUF SON COPS BT 001/198 02023")).toMatchObject({ setId: "sv01", num: 1 });
    expect(best("ET 30C 010/128 LC")).toMatchObject({ setId: "30th", num: 10 });
  });
  it("rejects impossible numbers and reads promos by their code", () => {
    expect(best("E R 282 NX 1 D LN 703/103 C P 4 I")).toBeUndefined();                       // 703 > 141
    expect(best("J MEP FR 088")).toMatchObject({ setId: "mep", num: 88 });
    expect(best("nothing useful here")).toBeUndefined();
    expect(best("CI SU O 08/ 084 1 SH C1 CC 4804")).toBeUndefined();
    expect(guessCards(parseScan("C1 08/ 084"), [...SETS, { id: "col1", code: "CL", official: 95, total: 106 }])).toEqual([]);   // a digit missing: recent cards always print 088/084
  });
  it("matches set codes with look-alike characters", () => {
    expect(codeScore("DLR", "DLR")).toBe(3);
    expect(codeScore("DIR", "DLR")).toBe(2);
    expect(codeScore("MFG", "MEG")).toBe(1);
    expect(codeScore("ABC", "DLR")).toBe(0);
  });
  it("waits for a second identical read before trusting a card", () => {
    const v = makeVoter();
    const weak = guessCards(parseScan("xx 001/198"), SETS);
    expect(v.add(weak)).toBeNull();
    expect(v.add(weak)).toMatchObject({ setId: "sv01", num: 1 });
    v.reset();
    expect(v.add(guessCards(parseScan("PBL FR 008/084"), SETS))).toBeNull();   // a misread is not enough on its own
    expect(v.add(guessCards(parseScan("PBL FR 088/084"), SETS))).toBeNull();
    expect(v.add(guessCards(parseScan("PBL FR 088/084"), SETS))).toMatchObject({ setId: "me05", num: 88 });
  });
  it("compares card numbers whatever their format", () => {
    expect(sameNumber("084", 84)).toBe(true);
    expect(sameNumber("SWSH074", 74)).toBe(true);
    expect(sameNumber("085", 84)).toBe(false);
  });
});

it("a lone set count next to the code is not taken for a card number", () => {
  const sets = [{ id: "me06", code: "DLR", official: 103, total: 141, date: "2026-11-06" }];
  expect(guessCards(parseScan("DLR FY 103\n7103"), sets)).toEqual([]);
  expect(guessCards(parseScan("DLR FR 084/103"), sets)[0]).toMatchObject({ setId: "me06", num: 84 });
});
