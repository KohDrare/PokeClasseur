import { describe, it, expect, vi } from "vitest";

/* a tiny in-memory Supabase: enough of the query builder for cloud/shared.js */
const db = { profiles: [{ id: "A", handle: "arthur", name: "Arthur", avatar: 25 }, { id: "B", handle: "leo", name: "Léo", avatar: 4 }], shared_sets: [], shared_members: [], shared_items: [] };
let seq = 0;
const pings = [];
function q(table) {
  const st = { f: [], op: "select", rows: null, patch: null, single: false };
  const match = r => st.f.every(([k, t, v]) => t === "eq" ? r[k] === v : v.includes(r[k]));
  const run = () => {
    const T = db[table];
    if (st.op === "insert") {
      for (const r of st.rows) {
        if (table === "shared_members" && T.some(x => x.shared_id === r.shared_id && x.user_id === r.user_id)) return { data: null, error: { code: "23505", message: "duplicate" } };
        T.push({ id: r.id || (table === "shared_sets" ? "S" + ++seq : undefined), ...r });
      }
      const out = T.slice(-st.rows.length);
      return { data: st.single ? out[0] : out, error: null };
    }
    if (st.op === "upsert") {
      for (const r of st.rows) { const i = T.findIndex(x => x.shared_id === r.shared_id && x.card_id === r.card_id && x.variant === r.variant); if (i >= 0) T[i] = { ...T[i], ...r }; else T.push({ ...r }); }
      return { data: null, error: null };
    }
    if (st.op === "update") { T.filter(match).forEach(r => Object.assign(r, st.patch)); return { data: null, error: null }; }
    if (st.op === "delete") {
      const gone = T.filter(match); db[table] = T.filter(r => !match(r));
      if (table === "shared_sets") for (const g of gone) for (const t of ["shared_members", "shared_items"]) db[t] = db[t].filter(r => r.shared_id !== g.id);
      return { data: null, error: null };
    }
    const data = T.filter(match).map(r => ({ ...r }));
    return { data: st.single ? (data[0] || null) : data, error: null };
  };
  const b = {
    select() { return b; }, eq(k, v) { st.f.push([k, "eq", v]); return b; }, in(k, v) { st.f.push([k, "in", v]); return b; },
    range() { return b; }, maybeSingle() { st.single = true; return b; }, single() { st.single = true; return b; },
    insert(r) { st.op = "insert"; st.rows = [].concat(r); return b; }, upsert(r) { st.op = "upsert"; st.rows = [].concat(r); return b; },
    update(p) { st.op = "update"; st.patch = p; return b; }, delete() { st.op = "delete"; return b; },
    then(ok, ko) { return Promise.resolve(run()).then(ok, ko); }
  };
  return b;
}
const channel = { on() { return this; }, subscribe() { return this; }, send: async m => { pings.push(m); return "ok"; } };
vi.mock("../src/cloud/session.js", () => ({ cloud: { enabled: true, user: null, supabase: { from: q, channel: () => channel, removeChannel() {} } } }));
vi.mock("../src/lib/ui.js", () => ({ toast() {} }));

const { cloud } = await import("../src/cloud/session.js");
const { S } = await import("../src/state/shared.js");
const C = await import("../src/state/collection.js");
const shared = await import("../src/cloud/shared.js");
const card = (id, setId = "me05") => ({ id, setId, ok: 0 });
const as = (who, col) => { cloud.user = { id: who }; S.COL = col; };

describe("shared extension", () => {
  const colA = { cards: { "me05-001": { s: "me05", v: { normal: 1 } }, "me05-116": { s: "me05", v: { holo: 1 } }, "sv08-010": { s: "sv08", v: { normal: 1 } } } };
  const colB = { cards: { "me05-001": { s: "me05", v: { reverse: 1 } }, "me06-001": { s: "me06", v: { normal: 1 } } } };

  it("A shares Nuit Noire with B: A's cards become the common list, everyone's", async () => {
    as("A", colA);
    await shared.shareSet("me05", "@leo");
    expect(db.shared_items).toHaveLength(2);
    expect(db.shared_items.every(r => r.owners === null)).toBe(true);
    expect(db.shared_members.map(m => m.user_id + ":" + m.status).sort()).toEqual(["A:active", "B:invited"]);
    expect(pings.length).toBeGreaterThan(0);
  });
  it("B accepts: his own Nuit Noire cards join the list, the rest stays private", async () => {
    as("B", colB);
    await shared.loadShared();
    expect(shared.SH.invites).toHaveLength(1);
    await shared.acceptInvite(shared.SH.invites[0].id);
    expect(db.shared_items).toHaveLength(3);
    expect(Object.keys(S.COL.cards).sort()).toEqual(["me05-001", "me05-116", "me06-001"]);   // A's holo mirrored, B's me06 untouched
    expect(S.COL.cards["me05-001"].v).toEqual({ normal: 1, reverse: 1 });
    expect(db.shared_items.some(r => r.card_id === "me06-001")).toBe(false);
  });
  it("a card added by B reaches A; owners chosen on a card are seen by all", async () => {
    C.setQty(card("me05-050"), "normal", 1);   // B adds a card
    await new Promise(r => setTimeout(r, 0));
    await shared.setOwners("me05-050", "normal", ["B"]);
    as("A", colA);
    await shared.loadShared();
    expect(S.COL.cards["me05-050"].v).toEqual({ normal: 1 });
    expect(shared.ownersOf("me05-050", "normal").map(m => m.user_id)).toEqual(["B"]);
    expect(shared.isMine("me05-050", "normal")).toBe(false);
    expect(shared.isMine("me05-001", "normal")).toBe(true);    // everyone's
    expect(shared.isMine("sv08-010", "normal")).toBe(true);    // not shared: mine
  });
  it("an owner removed by mistake can be put back (everyone again)", async () => {
    await shared.setOwners("me05-001", "normal", ["A"]);
    await shared.setOwners("me05-001", "normal", ["A", "B"]);
    expect(db.shared_items.find(r => r.card_id === "me05-001" && r.variant === "normal").owners).toBe(null);
    expect(shared.ownersOf("me05-001", "normal").map(m => m.user_id).sort()).toEqual(["A", "B"]);
  });
  it("B leaves: keeps the cards that are (also) his", async () => {
    await shared.setOwners("me05-116", "holo", ["A"]);         // A says the holo is his
    as("B", colB);
    await shared.loadShared();
    await shared.leaveShare("me05");
    expect(S.COL.cards["me05-116"]).toBeUndefined();
    expect(S.COL.cards["me05-050"].v).toEqual({ normal: 1 });
    expect(db.shared_members.some(m => m.user_id === "B")).toBe(false);
  });
});
