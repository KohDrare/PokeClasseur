import { describe, it, expect, vi, beforeEach } from "vitest";
import { colToItems, colToPurchases, rowsToCol, mergeCols, diffItems } from "../src/cloud/mapping.js";

const local = {
  cards: {
    "me05-001": { s: "me05", v: { normal: 1, reverse: 2 }, d: [357] },
    "me05-116": { s: "me05", v: { holo: 1 } }
  },
  products: { me05: [{ id: "p1", type: "booster", name: "Booster Nuit Noire", qty: 3, sealed: false, price: 5.5 }] }
};

describe("mapping", () => {
  it("turns the collection into one row per card and version", () => {
    const rows = colToItems(local);
    expect(rows).toHaveLength(3);
    expect(rows).toContainEqual({ card_id: "me05-001", variant: "reverse", set_id: "me05", qty: 2, dex_ids: [357] });
  });
  it("upgrades old purchases (sealed flag) to opened counts", () => {
    expect(colToPurchases(local)[0]).toMatchObject({ id: "p1", qty: 3, opened: 3, price: 5.5, set_id: "me05" });
  });
  it("round-trips rows back to a collection", () => {
    const back = rowsToCol(colToItems(local), colToPurchases(local));
    expect(back.cards["me05-001"].v).toEqual({ normal: 1, reverse: 2 });
    expect(back.products.me05[0].opened).toBe(3);
  });
  it("merges two devices without losing cards (highest quantity wins)", () => {
    const other = { cards: { "me05-001": { s: "me05", v: { normal: 4 } }, "sv08-010": { s: "sv08", v: { normal: 1 } } }, products: {} };
    const m = mergeCols(local, other);
    expect(m.cards["me05-001"].v).toEqual({ normal: 4, reverse: 2 });
    expect(m.cards["sv08-010"]).toBeTruthy();
    expect(m.products.me05).toHaveLength(1);
  });
  it("sends only what changed", () => {
    const before = colToItems(local);
    const next = colToItems({ cards: { "me05-001": { s: "me05", v: { normal: 1, reverse: 3 }, d: [357] } } });
    const d = diffItems(before, next);
    expect(d.upserts.map(r => r.variant)).toEqual(["reverse"]);
    expect(d.deletes.map(r => r.card_id + "|" + r.variant)).toEqual(["me05-116|holo"]);
  });
});

/* ---- sync engine against an in-memory fake of the Supabase client ---- */
const db = { collection_items: [], purchases: [] };
function table(name) {
  const rows = () => db[name];
  const q = { filters: [] };
  const api = {
    select: () => api,
    range: async (a, b) => ({ data: rows().slice(a, b + 1).map(r => ({ ...r })), error: null }),
    upsert: async (list, { onConflict }) => {
      const keys = onConflict.split(",").filter(k => k !== "user_id");
      for (const r of list) { const i = rows().findIndex(x => keys.every(k => x[k] === r[k])); if (i >= 0) rows()[i] = { ...r }; else rows().push({ ...r }); }
      return { error: null };
    },
    delete: () => ({
      eq(col, val) { q.filters.push(r => r[col] === val); return this; },
      async in(col, vals) { q.filters.push(r => vals.includes(r[col])); db[name] = rows().filter(r => !q.filters.every(f => f(r))); q.filters = []; return { error: null }; }
    })
  };
  return api;
}
vi.mock("../src/cloud/client.js", () => ({ cloudEnabled: true, supabase: { from: table } }));

describe("cloud sync", () => {
  beforeEach(() => { db.collection_items = [{ card_id: "sv08-010", variant: "normal", set_id: "sv08", qty: 1, dex_ids: [] }]; db.purchases = []; });

  it("merges the cloud copy with this device on sign-in, then uploads changes", async () => {
    const { S } = await import("../src/state/shared.js");
    const { setQty } = await import("../src/state/collection.js");
    const sync = await import("../src/cloud/sync.js");
    S.COL = JSON.parse(JSON.stringify(local));
    await sync.startSync("user-1");
    expect(Object.keys(S.COL.cards).sort()).toEqual(["me05-001", "me05-116", "sv08-010"]);
    expect(db.collection_items).toHaveLength(4);
    expect(db.purchases).toHaveLength(1);
    expect(sync.syncState.status).toBe("ok");

    vi.useFakeTimers();
    setQty({ id: "me05-116", setId: "me05" }, "holo", 0);
    sync.queuePush();
    await vi.advanceTimersByTimeAsync(1500);
    vi.useRealTimers();
    await new Promise(r => setTimeout(r, 0));
    expect(db.collection_items.find(r => r.card_id === "me05-116")).toBeUndefined();
    expect(db.collection_items).toHaveLength(3);
  });
});
