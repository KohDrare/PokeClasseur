import { describe, expect, it } from "vitest";
import { HANDLE_RE, profileError, toHandle } from "../src/cloud/profiles.js";

describe("pseudos", () => {
  it("turns any text into a valid pseudo", () => {
    expect(toHandle("Léa Évoli")).toBe("lea.evoli");
    expect(toHandle("  Arthur_Koh!!")).toBe("arthur_koh");
    expect(toHandle("a  b")).toBe("a.b");
    expect(toHandle("x".repeat(40))).toHaveLength(24);
  });
  it("matches the database rule", () => {
    expect(HANDLE_RE.test("arthur.koh")).toBe(true);
    expect(HANDLE_RE.test("ab")).toBe(false);
    expect(HANDLE_RE.test("Arthur")).toBe(false);
  });
  it("explains server errors in French", () => {
    expect(profileError({ code: "23505", message: "duplicate key" })).toMatch(/déjà pris/);
    expect(profileError({ message: "column profiles.showcase does not exist" })).toMatch(/0002/);
    expect(profileError({ message: "Failed to fetch" })).toMatch(/joindre le serveur/);
  });
});
