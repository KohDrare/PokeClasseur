import { describe, it, expect, vi } from "vitest";

/* a fake server copy of user_binders */
let server = null;
const table = {
  select() { return this; }, eq() { return this; },
  maybeSingle: async () => ({ data: server ? { data: structuredClone(server) } : null, error: null }),
  upsert: async row => { server = structuredClone(row.data); return { error: null }; }
};
vi.mock("../src/cloud/client.js", () => ({ supabase: { from: () => table } }));
vi.mock("../src/lib/ui.js", () => ({ toast() {} }));
const { mergeBinders, pullBinders, stopBinders } = await import("../src/cloud/binders-sync.js");
const { LS } = await import("../src/lib/storage.js");

const b = (id, name, upd) => ({ id, name, cards: [], upd });
describe("binders between devices", () => {
  it("keeps the newest version of each binder and both devices' new ones", () => {
    const m = mergeBinders({ list: [b("a", "A phone", 5), b("p", "Only phone", 3)] }, { list: [b("a", "A mac", 9), b("m", "Only mac", 4)] });
    expect(m.list.map(x => x.name)).toEqual(["A mac", "Only phone", "Only mac"]);
  });
  it("a binder deleted on one device disappears on the other, unless changed after", () => {
    expect(mergeBinders({ list: [b("a", "A", 5)] }, { list: [], gone: { a: 6 } }).list).toEqual([]);
    expect(mergeBinders({ list: [b("a", "A", 7)] }, { list: [], gone: { a: 6 } }).list.map(x => x.id)).toEqual(["a"]);
  });
  it("phone creates, mac downloads it, mac deletes, phone loses it", async () => {
    LS.set("pc-binders", [b("x", "AllOfHit", 10)]); LS.set("pc-binders-gone", {});
    await pullBinders("U");                        // phone: server is empty → uploaded
    expect(server.list.map(x => x.name)).toEqual(["AllOfHit"]);
    LS.set("pc-binders", []); LS.set("pc-binders-gone", {});
    await pullBinders("U");                        // mac: gets it
    expect(LS.get("pc-binders").map(x => x.name)).toEqual(["AllOfHit"]);
    LS.set("pc-binders", []); LS.set("pc-binders-gone", { x: 20 });
    await pullBinders("U");                        // mac deletes it
    expect(server.list).toEqual([]);
    LS.set("pc-binders", [b("x", "AllOfHit", 10)]); LS.set("pc-binders-gone", {});
    await pullBinders("U");                        // phone: gone
    expect(LS.get("pc-binders")).toEqual([]);
    stopBinders();
  });
});
