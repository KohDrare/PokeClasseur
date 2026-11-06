/* Keeps the local collection and the user's cloud copy in step.
   - on sign-in: download, merge with what is on this device, upload the difference
   - after every local change: upload only what changed (debounced) */
import { supabase } from "./client.js";
import { colToItems, colToPurchases, rowsToCol, mergeCols, diffItems, diffPurchases } from "./mapping.js";
import { S } from "../state/shared.js";
import { COL_KEY } from "../state/collection.js";
import { LS } from "../lib/storage.js";

let userId = null;
let synced = { items: [], purchases: [] };   // what the database holds, as far as we know
let timer = null, running = null;
const listeners = new Set();
export const syncState = { status: "off", at: 0, error: "" };   // off | syncing | ok | error | offline
export const onSyncState = fn => { listeners.add(fn); return () => listeners.delete(fn); };
function setStatus(status, error = "") { Object.assign(syncState, { status, error, at: status === "ok" ? Date.now() : syncState.at }); listeners.forEach(f => f(syncState)); }

async function fetchAll(table, columns) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from(table).select(columns).range(from, from + 999);
    if (error) throw error;
    out.push(...data);
    if (data.length < 1000) return out;
  }
}

async function push() {
  const items = colToItems(S.COL), purchases = colToPurchases(S.COL);
  const di = diffItems(synced.items, items), dp = diffPurchases(synced.purchases, purchases);
  if (di.upserts.length) for (let i = 0; i < di.upserts.length; i += 500) {
    const { error } = await supabase.from("collection_items").upsert(di.upserts.slice(i, i + 500), { onConflict: "user_id,card_id,variant" });
    if (error) throw error;
  }
  const byVariant = {};
  di.deletes.forEach(r => (byVariant[r.variant] ||= []).push(r.card_id));
  for (const [variant, ids] of Object.entries(byVariant)) for (let i = 0; i < ids.length; i += 200) {
    const { error } = await supabase.from("collection_items").delete().eq("variant", variant).in("card_id", ids.slice(i, i + 200));
    if (error) throw error;
  }
  if (dp.upserts.length) { const { error } = await supabase.from("purchases").upsert(dp.upserts, { onConflict: "user_id,id" }); if (error) throw error; }
  if (dp.deletes.length) { const { error } = await supabase.from("purchases").delete().in("id", dp.deletes.map(r => r.id)); if (error) throw error; }
  synced = { items, purchases };
}

function run(task) {
  running = (running || Promise.resolve()).then(async () => {
    if (!userId) return;
    if (!navigator.onLine) { setStatus("offline"); return; }
    setStatus("syncing");
    try { await task(); setStatus("ok"); }
    catch (e) { console.error("[sync]", e); setStatus("error", e.message || String(e)); }
  });
  return running;
}

/** called right after sign-in (or on page load with an existing session) */
export function startSync(uid) {
  userId = uid;
  return run(async () => {
    const [items, purchases] = await Promise.all([fetchAll("collection_items", "card_id,variant,set_id,qty,dex_ids"), fetchAll("purchases", "id,set_id,type,name,qty,opened,bpp,price")]);
    synced = { items, purchases };
    const merged = mergeCols(S.COL, rowsToCol(items, purchases));
    S.COL = merged;
    LS.set(COL_KEY, S.COL);
    await push();
    dispatchEvent(new CustomEvent("collection:replaced"));
  });
}

export function stopSync() { userId = null; synced = { items: [], purchases: [] }; clearTimeout(timer); setStatus("off"); }

/** schedule an upload of local changes */
export function queuePush() {
  if (!userId) return;
  clearTimeout(timer);
  timer = setTimeout(() => run(push), 1200);
}


addEventListener("online", () => { if (userId) run(push); });
