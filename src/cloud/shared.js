/* Shared extensions: several accounts keep ONE list of cards for an extension (tables shared_sets,
   shared_members, shared_items, see supabase/migrations/0004_shared.sql).
   - every card version of a shared extension has owners: everyone by default (owners = null),
     or the members picked on the card; a change is seen by all members
   - the shared list is copied into this device's collection ("mirror"), so every page works as usual;
     a change made here (setQty → "card:qty") is written to the shared list and the others are told
   - live: a message on the share's channel makes the others download it again; also every 30 s and
     when the app comes back on screen */
import { cloud } from "./session.js";
import { S } from "../state/shared.js";
import { saveCol } from "../state/collection.js";

export const SH = { ready: false, bySet: {}, invites: [], error: "" };
let chans = new Map(), pullTimer = null, poll = null, started = false;
const db = () => cloud.supabase;
const me = () => cloud.user?.id;
const ik = (card, v) => card + "|" + v;
const emit = () => dispatchEvent(new CustomEvent("shared:changed"));
const setOfCard = id => id.slice(0, id.lastIndexOf("-"));

/* ---------- reading ---------- */
export const sharedOf = setId => (SH.bySet[setId]?.status === "active" ? SH.bySet[setId] : null);
export const activeMembers = sh => sh.members.filter(m => m.status === "active");
export const memberName = m => m?.profile?.name || (m?.profile?.handle ? "@" + m.profile.handle : "Membre");
/** owners of a card version in a shared extension: the member list, or null when the set is not shared */
export function ownersOf(cardId, variant) {
  const sh = sharedOf(S.COL.cards[cardId]?.s || setOfCard(cardId)); if (!sh) return null;
  const it = sh.items.get(ik(cardId, variant)); if (!it) return null;
  const act = activeMembers(sh);
  return it.owners?.length ? act.filter(m => it.owners.includes(m.user_id)) : act;
}
/** is this copy (also) mine? true outside shared extensions */
export function isMine(cardId, variant) {
  const o = ownersOf(cardId, variant);
  return !o || o.some(m => m.user_id === me());
}

async function all(q) {
  const out = [];
  for (let from = 0; ; from += 1000) { const { data, error } = await q().range(from, from + 999); if (error) throw error; out.push(...data); if (data.length < 1000) return out; }
}

export async function loadShared() {
  if (!db() || !me()) return;
  const { data: mine, error } = await db().from("shared_members").select("shared_id,status").eq("user_id", me());
  if (error) { SH.error = /shared_members/.test(error.message || "") ? "missing" : error.message; SH.ready = true; emit(); return; }
  SH.error = "";
  const ids = mine.map(m => m.shared_id);
  const bySet = {}, invites = [];
  if (ids.length) {
    const [{ data: sets }, members] = await Promise.all([
      db().from("shared_sets").select("id,set_id,owner,created_at").in("id", ids),
      all(() => db().from("shared_members").select("shared_id,user_id,status,invited_by").in("shared_id", ids))
    ]);
    const uids = [...new Set(members.flatMap(m => [m.user_id, m.invited_by]).filter(Boolean))];
    const { data: profs } = uids.length ? await db().from("profiles").select("id,handle,name,avatar").in("id", uids) : { data: [] };
    const P = new Map((profs || []).map(p => [p.id, p]));
    const active = mine.filter(m => m.status === "active").map(m => m.shared_id);
    const items = active.length ? await all(() => db().from("shared_items").select("shared_id,card_id,variant,qty,owners").in("shared_id", active)) : [];
    for (const s of sets || []) {
      const my = mine.find(m => m.shared_id === s.id);
      const sh = {
        id: s.id, setId: s.set_id, owner: s.owner, status: my.status,
        members: members.filter(m => m.shared_id === s.id).map(m => ({ ...m, profile: P.get(m.user_id) || null })),
        items: new Map(items.filter(i => i.shared_id === s.id).map(i => [ik(i.card_id, i.variant), i]))
      };
      if (my.status === "invited") invites.push({ ...sh, by: P.get(members.find(m => m.shared_id === s.id && m.user_id === me())?.invited_by) || null });
      else bySet[s.set_id] = sh;
    }
  }
  SH.bySet = bySet; SH.invites = invites; SH.ready = true;
  listen();
  mirror();
  emit();
}

/* the shared lists → this device's collection (same quantities; my condition / language / favourite kept) */
function mirror() {
  let changed = false;
  for (const sh of Object.values(SH.bySet)) {
    const want = {};
    for (const it of sh.items.values()) (want[it.card_id] ||= {})[it.variant] = it.qty;
    for (const [id, e] of Object.entries(S.COL.cards)) {
      if ((e.s || setOfCard(id)) !== sh.setId || want[id]) continue;
      delete S.COL.cards[id]; changed = true;
    }
    for (const [id, v] of Object.entries(want)) {
      const e = S.COL.cards[id] || (S.COL.cards[id] = { s: sh.setId, v: {}, t: Date.now() });
      if (JSON.stringify(e.v) !== JSON.stringify(v)) { e.v = v; changed = true; }
    }
  }
  if (changed) { saveCol(); dispatchEvent(new CustomEvent("collection:remote")); }
}

/* ---------- live ---------- */
function ping(id) { chans.get(id)?.send({ type: "broadcast", event: "changed", payload: {} }).catch(() => {}); }
export function schedulePull(delay = 300) { if (!me()) return; clearTimeout(pullTimer); pullTimer = setTimeout(() => loadShared().catch(e => console.warn("[partage]", e)), delay); }
function listen() {
  const want = new Set([...Object.values(SH.bySet).map(s => s.id), ...SH.invites.map(s => s.id)]);
  for (const [id, ch] of chans) if (!want.has(id)) { db().removeChannel(ch); chans.delete(id); }
  for (const id of want) if (!chans.has(id))
    chans.set(id, db().channel(`pc-shared-${id}`, { config: { broadcast: { self: false } } }).on("broadcast", { event: "changed" }, () => schedulePull()).subscribe());
}

/* ---------- writing ---------- */
async function writeItem(sh, cardId, variant, qty, owners) {
  const k = ik(cardId, variant);
  if (qty > 0) {
    const row = { shared_id: sh.id, card_id: cardId, variant, qty, owners: owners ?? sh.items.get(k)?.owners ?? null, updated_by: me(), updated_at: new Date().toISOString() };
    sh.items.set(k, row);
    const { error } = await db().from("shared_items").upsert(row, { onConflict: "shared_id,card_id,variant" });
    if (error) throw error;
  } else {
    sh.items.delete(k);
    const { error } = await db().from("shared_items").delete().eq("shared_id", sh.id).eq("card_id", cardId).eq("variant", variant);
    if (error) throw error;
  }
  ping(sh.id);
}
/** owners of a card version: a list of member ids (all members = everyone, stored as null) */
export async function setOwners(cardId, variant, ids) {
  const sh = sharedOf(S.COL.cards[cardId]?.s || setOfCard(cardId)); if (!sh) return;
  const it = sh.items.get(ik(cardId, variant)); if (!it || !ids.length) return;
  const act = activeMembers(sh).map(m => m.user_id);
  const owners = act.every(x => ids.includes(x)) ? null : ids;
  await writeItem(sh, cardId, variant, it.qty, owners);
  emit();
}
/* a quantity changed here (set page, card, scanner…): to the shared list */
addEventListener("card:qty", e => {
  const { id, setId, variant, n } = e.detail, sh = sharedOf(setId);
  if (sh) writeItem(sh, id, variant, n).catch(x => { console.warn("[partage]", x); schedulePull(0); });
});

/* ---------- sharing ---------- */
export async function findMember(handle) {
  const h = handle.trim().replace(/^@/, "").toLowerCase();
  const { data, error } = await db().from("profiles").select("id,handle,name,avatar").eq("handle", h).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error(`Aucun dresseur avec l'identifiant @${h}.`);
  if (data.id === me()) throw new Error("C'est ton propre identifiant.");
  return data;
}
/** shares an extension (my cards of it become the common list, owned by everyone) and invites someone */
export async function shareSet(setId, handle) {
  const who = await findMember(handle);
  let sh = SH.bySet[setId];
  if (!sh) {
    const { data, error } = await db().from("shared_sets").insert({ set_id: setId, owner: me() }).select("id").single();
    if (error) throw error;
    const { error: e2 } = await db().from("shared_members").insert({ shared_id: data.id, user_id: me(), status: "active", invited_by: me() });
    if (e2) throw e2;
    const rows = [];
    for (const [id, e] of Object.entries(S.COL.cards)) if ((e.s || setOfCard(id)) === setId)
      for (const [v, q] of Object.entries(e.v || {})) if (q > 0) rows.push({ shared_id: data.id, card_id: id, variant: v, qty: q, owners: null, updated_by: me() });
    for (let i = 0; i < rows.length; i += 500) { const { error: e3 } = await db().from("shared_items").insert(rows.slice(i, i + 500)); if (e3) throw e3; }
    sh = { id: data.id };
  }
  const { error } = await db().from("shared_members").insert({ shared_id: sh.id, user_id: who.id, status: "invited", invited_by: me() });
  if (error && error.code !== "23505") throw error;
  await loadShared();
  ping(sh.id);
  return who;
}
/** accepts an invitation: my own cards of the extension join the common list */
export async function acceptInvite(sharedId) {
  const { error } = await db().from("shared_members").update({ status: "active" }).eq("shared_id", sharedId).eq("user_id", me());
  if (error) throw error;
  const inv = SH.invites.find(i => i.id === sharedId);
  if (inv) {
    const items = await all(() => db().from("shared_items").select("card_id,variant,qty").eq("shared_id", sharedId));
    const have = new Map(items.map(i => [ik(i.card_id, i.variant), i.qty]));
    const rows = [];
    for (const [id, e] of Object.entries(S.COL.cards)) if ((e.s || setOfCard(id)) === inv.setId)
      for (const [v, q] of Object.entries(e.v || {})) if (q > (have.get(ik(id, v)) || 0)) rows.push({ shared_id: sharedId, card_id: id, variant: v, qty: q, owners: null, updated_by: me() });
    if (rows.length) { const { error: e2 } = await db().from("shared_items").upsert(rows, { onConflict: "shared_id,card_id,variant" }); if (e2) throw e2; }
  }
  await loadShared();
  ping(sharedId);
}
export async function declineInvite(sharedId) {
  const { error } = await db().from("shared_members").delete().eq("shared_id", sharedId).eq("user_id", me());
  if (error) throw error;
  await loadShared();
}
/** leaves a shared extension (its creator ends it for everyone). I keep the cards that are (also) mine. */
export async function leaveShare(setId) {
  const sh = SH.bySet[setId]; if (!sh) return;
  for (const it of sh.items.values()) {
    if (it.owners?.length && !it.owners.includes(me())) { const e = S.COL.cards[it.card_id]; if (e) { delete e.v[it.variant]; if (!Object.keys(e.v).length) delete S.COL.cards[it.card_id]; } }
  }
  const q = sh.owner === me() ? db().from("shared_sets").delete().eq("id", sh.id) : db().from("shared_members").delete().eq("shared_id", sh.id).eq("user_id", me());
  const { error } = await q; if (error) throw error;
  ping(sh.id);
  delete SH.bySet[setId];
  saveCol(); emit();
  await loadShared();
}

/* ---------- start / stop (account.js) ---------- */
export function startShared() {
  if (started) return schedulePull(0);
  started = true;
  schedulePull(0);
  poll = setInterval(() => { if (document.visibilityState === "visible") schedulePull(0); }, 30e3);
}
export function stopShared() {
  started = false; clearInterval(poll); clearTimeout(pullTimer);
  for (const ch of chans.values()) db()?.removeChannel(ch);
  chans = new Map(); SH.bySet = {}; SH.invites = []; SH.ready = false; emit();
}
document.addEventListener("visibilitychange", () => { if (started && document.visibilityState === "visible") schedulePull(0); });
addEventListener("focus", () => { if (started) schedulePull(0); });
