/* Keeps the local collection and the user's cloud copy in step, on every device signed in to the account.
   - on sign-in: download, merge with what is on this device, upload the difference
   - after every local change: upload only what changed (debounced), then tell the other devices
   - the other devices download right away (live message), when the app comes back on screen,
     and every 30 seconds while it is open; what changed on this device since the last sync is kept */
import { supabase } from "./client.js";
import { colToItems, colToPurchases, rowsToCol, mergeCols, diffItems, diffPurchases, mergeItems, mergePurchases } from "./mapping.js";
import { S } from "../state/shared.js";
import { COL_KEY } from "../state/collection.js";
import { LS } from "../lib/storage.js";

let userId = null;
let synced = { items: [], purchases: [] };   // what the database holds, as far as we know
let timer = null, running = null, channel = null, poll = null, pullTimer = null;
let ext = true;                               // the database has the condition / language / favourite columns (migration 0003)
const ITEM_COLS = "card_id,variant,set_id,qty,dex_ids", EXT_COLS = ",cond,lang,fav,added_at";
const listeners = new Set();
export const syncState = { status: "off", at: 0, error: "" };   // off | syncing | ok | error | offline
export const onSyncState = fn => { listeners.add(fn); return () => listeners.delete(fn); };
function setStatus(status, error = "") { Object.assign(syncState, { status, error, at: status === "ok" ? Date.now() : syncState.at }); listeners.forEach(f => f(syncState)); }

async function fetchAll(table, columns) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    // only my rows: public collections of other trainers are readable too (migration 0005)
    const { data, error } = await supabase.from(table).select(columns).eq("user_id", userId).range(from, from + 999);
    if (error) throw error;
    out.push(...data);
    if (data.length < 1000) return out;
  }
}
const missingColumn = e => e && (e.code === "42703" || e.code === "PGRST204" || /column/i.test(e.message || ""));
async function fetchItems() {
  if (ext) try { return await fetchAll("collection_items", ITEM_COLS + EXT_COLS); } catch (e) { if (!missingColumn(e)) throw e; ext = false; }
  return fetchAll("collection_items", ITEM_COLS);
}
const fetchRemote = () => Promise.all([fetchItems(), fetchAll("purchases", "id,set_id,type,name,qty,opened,bpp,price")]);

async function push() {
  const items = colToItems(S.COL, ext), purchases = colToPurchases(S.COL);
  const di = diffItems(synced.items, items), dp = diffPurchases(synced.purchases, purchases);
  if (di.upserts.length) for (let i = 0; i < di.upserts.length; i += 500) {
    const { error } = await supabase.from("collection_items").upsert(di.upserts.slice(i, i + 500), { onConflict: "user_id,card_id,variant" });
    if (error && ext && missingColumn(error)) { ext = false; return push(); }
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
  if (di.upserts.length || di.deletes.length || dp.upserts.length || dp.deletes.length) ping();
}

/* the collection from the database rows, keeping on this device what the database cannot hold yet */
function fromRows(items, purchases) {
  const col = rowsToCol(items, purchases);
  if (!ext) for (const [id, e] of Object.entries(col.cards)) {
    const old = S.COL.cards?.[id]; if (!old) continue;
    for (const k of ["c", "l", "f", "t"]) if (old[k] != null) e[k] = old[k];
  }
  return col;
}

/* download what the other devices changed */
async function pull() {
  const [items, purchases] = await fetchRemote();
  const before = JSON.stringify(colToItems(S.COL, true)) + JSON.stringify(colToPurchases(S.COL));
  const mi = mergeItems(synced.items, colToItems(S.COL, ext), items), mp = mergePurchases(synced.purchases, colToPurchases(S.COL), purchases);
  synced = { items, purchases };
  const col = fromRows(mi, mp);
  if (JSON.stringify(colToItems(col, true)) + JSON.stringify(colToPurchases(col)) !== before) {
    S.COL = col; LS.set(COL_KEY, S.COL);
    dispatchEvent(new CustomEvent("collection:remote"));
  }
  await push();   // what changed here meanwhile
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

/* live messages between the devices of the account: "something changed, download it" */
function ping() { channel?.send({ type: "broadcast", event: "changed", payload: {} }).catch(() => {}); }
export function schedulePull(delay = 300) {
  if (!userId) return;
  clearTimeout(pullTimer);
  pullTimer = setTimeout(() => run(pull), delay);
}
function listen(uid) {
  channel = supabase.channel(`pc-sync-${uid}`, { config: { broadcast: { self: false } } })
    .on("broadcast", { event: "changed" }, () => schedulePull())
    .subscribe();
  clearInterval(poll);
  poll = setInterval(() => { if (document.visibilityState === "visible") schedulePull(0); }, 30e3);
}

/** called right after sign-in (or on page load with an existing session) */
export function startSync(uid) {
  userId = uid;
  listen(uid);
  return run(async () => {
    const [items, purchases] = await fetchRemote();
    synced = { items, purchases };
    const merged = mergeCols(S.COL, fromRows(items, purchases));
    S.COL = merged;
    LS.set(COL_KEY, S.COL);
    await push();
    dispatchEvent(new CustomEvent("collection:replaced"));
  });
}

export function stopSync() {
  userId = null; synced = { items: [], purchases: [] }; clearTimeout(timer); clearTimeout(pullTimer); clearInterval(poll);
  if (channel) { supabase.removeChannel(channel); channel = null; }
  setStatus("off");
}

/** schedule an upload of local changes */
export function queuePush() {
  if (!userId) return;
  clearTimeout(timer);
  timer = setTimeout(() => run(push), 1200);
}

addEventListener("online", () => { if (userId) run(pull); });
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") schedulePull(0); });
addEventListener("focus", () => schedulePull(0));   // back to the window on a computer
