/* Public profiles and follows (tables "profiles" and "follows", see supabase/migrations/0002). */
import { cloud, setCloud } from "./session.js";

export const HANDLE_RE = /^[a-z0-9._]{3,24}$/;
export const PROFILE_FIELDS = "id, handle, name, avatar, city, bio, showcase, show_collection, created_at";

/* turns any text into a valid pseudo: lowercase, no accents, only a-z 0-9 . _ */
export function toHandle(s) {
  return (s || "").replace(/^[\s.]+/, "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/\s+/g, ".").replace(/[^a-z0-9._]/g, "").replace(/\.{2,}/g, ".").slice(0, 24);
}

/* clear French messages for what Supabase / Postgres send back */
export function profileError(e) {
  const m = (e && (e.message || e.details)) || "";
  if (e?.code === "23505" || /duplicate|unique/i.test(m)) return "Ce pseudo est déjà pris : essaies-en un autre.";
  if (/handle_check/.test(m)) return "Le pseudo doit faire 3 à 24 caractères : lettres minuscules, chiffres, point ou tiret bas.";
  if (/showcase|show_collection|profile_card|follows/.test(m) && /exist|find|schema cache/i.test(m)) return "Le serveur n'est pas à jour : lance le fichier supabase/migrations/0002_profiles_social.sql dans Supabase.";
  if (/fetch|network/i.test(m)) return "Impossible de joindre le serveur. Vérifie ta connexion et réessaie.";
  return m || "Une erreur est survenue.";
}

const db = () => { if (!cloud.supabase) throw new Error("Serveur pas encore chargé"); return cloud.supabase; };

export async function loadMyProfile() {
  if (!cloud.user) { setCloud({ profile: null }); return null; }
  const { data, error } = await db().from("profiles").select("*").eq("id", cloud.user.id).maybeSingle();
  if (error) throw error;
  setCloud({ profile: data || { id: cloud.user.id, handle: null } });
  return data;
}

export async function handleTaken(handle) {
  const { data, error } = await db().from("profiles").select("id").eq("handle", handle).maybeSingle();
  if (error) throw error;
  return !!data && data.id !== cloud.user?.id;
}

/* saves the editable fields of my profile; returns the saved row */
export async function saveMyProfile(fields) {
  const allowed = ["handle", "name", "avatar", "city", "bio", "showcase", "show_collection"];
  const patch = Object.fromEntries(Object.entries(fields).filter(([k]) => allowed.includes(k)));
  const { data, error } = await db().from("profiles").update(patch).eq("id", cloud.user.id).select("*").single();
  if (error) throw error;
  setCloud({ profile: data });
  return data;
}

/* public card of a trainer: infos, counts, collection summary (null when not found) */
export async function getProfileCard(handle) {
  const { data, error } = await db().rpc("profile_card", { p_handle: handle });
  if (error) throw error;
  return data;
}

export async function setFollow(userId, on) {
  const q = on
    ? db().from("follows").insert({ followee: userId })
    : db().from("follows").delete().eq("follower", cloud.user.id).eq("followee", userId);
  const { error } = await q;
  if (error && error.code !== "23505") throw error;
}

/* who follows a trainer ("followers") or who a trainer follows ("following") */
export async function listFollows(userId, dir) {
  const [mine, other] = dir === "followers" ? ["followee", "follower"] : ["follower", "followee"];
  const { data, error } = await db().from("follows").select(`p:profiles!follows_${other}_fkey(${PROFILE_FIELDS})`)
    .eq(mine, userId).order("created_at", { ascending: false }).limit(200);
  if (error) throw error;
  return data.map(r => r.p).filter(p => p && p.handle);
}

export async function searchProfiles(q, limit = 12) {
  const t = q.trim().replace(/[%_,()]/g, " ").trim();
  let req = db().from("profiles").select(PROFILE_FIELDS).not("handle", "is", null);
  if (t) req = req.or(`handle.ilike.%${t}%,name.ilike.%${t}%`);
  const { data, error } = await req.order("created_at", { ascending: false }).limit(limit);
  if (error) throw error;
  return data.filter(p => p.id !== cloud.user?.id);
}
