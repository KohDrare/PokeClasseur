/* Your binders on every device signed in to the account (table user_binders, migration 0007).
   Each binder carries the time of its last change ("upd"); a deleted one leaves its id and time in "gone".
   Merging two copies keeps, for every binder, the most recent version, and drops the deleted ones. */
import { supabase } from "./client.js";
import { LS } from "../lib/storage.js";
import { toast } from "../lib/ui.js";

const KEY = "pc-binders", GONE = "pc-binders-gone";
let uid = null, missing = false, timer = null, notify = () => {};
export const setBinderPing = fn => { notify = fn; };

/** local + remote → one list (local order first) and the deletions of both */
export function mergeBinders(local, remote) {
  const gone = { ...(remote?.gone || {}) };
  for (const [id, t] of Object.entries(local.gone || {})) gone[id] = Math.max(gone[id] || 0, t);
  const best = new Map(), order = [];
  for (const b of [...(local.list || []), ...(remote?.list || [])]) {
    if (!b?.id) continue;
    const cur = best.get(b.id);
    if (!cur) order.push(b.id);
    if (!cur || (b.upd || 0) > (cur.upd || 0)) best.set(b.id, b);
  }
  const list = order.map(id => best.get(id)).filter(b => !(gone[b.id] >= (b.upd || 0)));
  return { list, gone };
}
const localCopy = () => ({ list: LS.get(KEY, []), gone: LS.get(GONE, {}) });
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function failed(e) {
  if (/user_binders/.test(e?.message || "") || e?.code === "42P01" || e?.code === "PGRST205") {
    if (!missing) toast("Pour synchroniser tes classeurs, lance 0007_user_binders.sql dans Supabase");
    missing = true; return;
  }
  console.warn("[classeurs]", e);
}
async function upload(data) {
  const { error } = await supabase.from("user_binders").upsert({ user_id: uid, data, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (error) throw error;
  notify();
}

/** download, merge, keep the result here and upload it when the server copy is behind */
export async function pullBinders(userId) {
  if (userId) uid = userId;
  if (!uid || missing) return;
  try {
    const { data, error } = await supabase.from("user_binders").select("data").eq("user_id", uid).maybeSingle();
    if (error) throw error;
    const local = localCopy(), remote = data?.data || null, m = mergeBinders(local, remote);
    if (!same(m.list, local.list) || !same(m.gone, local.gone)) {
      LS.set(KEY, m.list); LS.set(GONE, m.gone);
      dispatchEvent(new CustomEvent("binders:changed", { detail: { remote: true } }));
    }
    if (!remote || !same(m.list, remote.list) || !same(m.gone, remote.gone || {})) await upload(m);
  } catch (e) { failed(e); }
}
export function stopBinders() { uid = null; clearTimeout(timer); }

/* a change made here: uploaded a moment later (after a fresh merge, so nothing from another device is lost) */
addEventListener("binders:changed", e => {
  if (e.detail?.remote || !uid || missing) return;
  clearTimeout(timer);
  timer = setTimeout(() => pullBinders(), 1000);
});
