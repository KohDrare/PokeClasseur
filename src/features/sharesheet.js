/* Shared extensions on screen: the line in an extension's header, the "Partager" sheet, the owner filter,
   the owners on a card. The data side is cloud/shared.js. */
import { $, ICON, esc } from "../lib/core.js";
import { toast } from "../lib/ui.js";
import { cloud, hasProfile } from "../cloud/session.js";
import { SH, activeMembers, leaveShare, memberName, ownersOf, setOwners, shareSet, sharedOf } from "../cloud/shared.js";
import { S } from "../state/shared.js";

const SPRITE = n => `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/home/${n || 25}.png`;
export const avatarImg = (m, cls = "shav") => `<img class="${cls}" src="${SPRITE(m?.profile?.avatar)}" alt="" title="${esc(memberName(m))}" loading="lazy">`;
const PEOPLE = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="8" r="3.2"/><path d="M3 20c.8-3.4 3.2-5.2 6-5.2s5.2 1.8 6 5.2"/><circle cx="17" cy="9" r="2.6"/><path d="M16.5 14.2c2.3.2 3.9 1.9 4.5 4.8"/></svg>`;
const isMe = m => m.user_id === cloud.user?.id;

/* ---------- extension header: shared with… + owner filter ---------- */
export function shareRowHTML(setId) {
  if (!cloud.enabled) return "";
  const sh = sharedOf(setId);
  if (!sh) return `<button class="pill ghost shbtn" id="hb-share">${PEOPLE} Partager</button>`;
  const act = activeMembers(sh), inv = sh.members.filter(m => m.status === "invited");
  const f = S.CUR?.owner || "";
  return `<div class="shrow">
      <button class="shwith" id="hb-share" title="Gérer le partage">${act.map(m => avatarImg(m)).join("")}<span>Partagée avec ${esc(act.filter(m => !isMe(m)).map(memberName).join(", ") || "personne pour l'instant")}${inv.length ? ` · ${inv.length} invitation${inv.length > 1 ? "s" : ""} en attente` : ""}</span></button>
      <div class="shfilter" id="sh-filter"><span>Voir</span><button class="${f ? "" : "on"}" data-u="">Toutes</button>${act.map(m => `<button class="${f === m.user_id ? "on" : ""}" data-u="${m.user_id}">${avatarImg(m, "shav sm")}${isMe(m) ? "Moi" : esc(memberName(m))}</button>`).join("")}</div>
    </div>`;
}
export function bindShareRow(setId, redraw) {
  const b = $("#hb-share"); if (b) b.onclick = () => openShareSheet(setId, redraw);
  const f = $("#sh-filter"); if (f) f.onclick = e => { const x = e.target.closest("[data-u]"); if (!x) return; S.CUR.owner = x.dataset.u || ""; redraw(); };
}
/** owner filter of the extension page: does this member own (part of) this card / version? */
export function ownedBy(userId, cardId, variants) {
  return variants.some(v => (ownersOf(cardId, v) || []).some(m => m.user_id === userId));
}
/* small owners on a tile, only when the card is not everyone's */
export function tileOwnersHTML(cardId, variants) {
  const sh = sharedOf(S.CUR?.data?.info?.id); if (!sh) return "";
  const all = activeMembers(sh).length, seen = new Map();
  let partial = false;
  for (const v of variants) { const o = ownersOf(cardId, v); if (!o) continue; if (o.length < all) partial = true; o.forEach(m => seen.set(m.user_id, m)); }
  return partial && seen.size ? `<span class="tileowners">${[...seen.values()].map(m => avatarImg(m, "shav xs")).join("")}</span>` : "";
}

/* ---------- card sheet: who owns each version ---------- */
export function cardOwnersHTML(card, variants) {
  const sh = sharedOf(card.setId || S.COL.cards[card.id]?.s); if (!sh) return "";
  const rows = variants.filter(v => ownersOf(card.id, v)).map(v => {
    const o = ownersOf(card.id, v).map(m => m.user_id);
    return `<div class="cown" data-v="${v}"><span class="cown-v">${esc(v === "normal" ? "Normale" : v === "reverse" ? "Reverse" : v === "holo" ? "Holo" : v)}</span>${activeMembers(sh).map(m => `<button class="${o.includes(m.user_id) ? "on" : ""}" data-u="${m.user_id}">${avatarImg(m, "shav sm")}${isMe(m) ? "Moi" : esc(memberName(m))}</button>`).join("")}</div>`;
  });
  return rows.length ? `<div class="cowners"><div class="cown-h">${PEOPLE} À qui est cette carte <small>touche pour ajouter ou retirer</small></div>${rows.join("")}</div>` : "";
}
export function bindCardOwners(card, redraw) {
  document.querySelectorAll(".cowners").forEach(box => box.onclick = async e => {
    const b = e.target.closest("[data-u]"); if (!b) return;
    const row = b.closest("[data-v]"), v = row.dataset.v;
    const cur = [...row.querySelectorAll("[data-u].on")].map(x => x.dataset.u);
    const next = b.classList.contains("on") ? cur.filter(x => x !== b.dataset.u) : [...cur, b.dataset.u];
    if (!next.length) { toast("Une carte a au moins un propriétaire"); return; }
    try { await setOwners(card.id, v, next); redraw(); } catch (x) { toast(x.message || "Modification impossible"); }
  });
}

/* ---------- the "Partager" sheet ---------- */
export function openShareSheet(setId, redraw = () => {}) {
  document.getElementById("sharesheet")?.remove();
  const el = document.createElement("div");
  el.id = "sharesheet"; el.className = "modal";
  document.body.append(el);
  const close = () => { el.remove(); removeEventListener("shared:changed", draw); removeEventListener("cloud:changed", draw); };
  const name = S.CUR?.data?.info?.name || "cette extension";
  let busy = false, msg = "";
  function draw() {
    if (!el.isConnected) return;
    const sh = sharedOf(setId);
    let body;
    if (!cloud.user) body = `<p class="note">Pour partager une extension, connecte-toi d'abord à ton compte.</p><div class="acts"><a class="pill" href="#/profil" id="sh-go">Aller au profil</a></div>`;
    else if (SH.error === "missing") body = `<p class="note err">Le serveur n'est pas encore prêt pour les partages : lance le fichier <b>0004_shared.sql</b> dans Supabase (SQL Editor → Run).</p>`;
    else if (!hasProfile()) body = `<p class="note">Choisis d'abord ton pseudo dans l'onglet Profil : c'est avec lui que tes amis te trouvent.</p><div class="acts"><a class="pill" href="#/profil" id="sh-go">Aller au profil</a></div>`;
    else {
      body = `${sh ? `<div class="shmembers">${sh.members.map(m => `<div class="shm">${avatarImg(m, "shav lg")}<div><b>${isMe(m) ? "Moi" : esc(memberName(m))}</b><small>${m.profile?.handle ? "@" + esc(m.profile.handle) : ""}${m.status === "invited" ? " · invitation envoyée" : m.user_id === sh.owner ? " · a créé le partage" : ""}</small></div></div>`).join("")}</div>`
        : `<p class="note">Vous aurez une seule liste de cartes pour <b>${esc(name)}</b> : ce que l'un ajoute, les autres le voient tout de suite. Tes cartes actuelles de l'extension deviennent la liste commune, à vous tous par défaut ; sur chaque carte, tu peux choisir à qui elle est. Le reste de ta collection reste privé.</p>`}
        <form id="sh-form" class="shform"><label for="sh-handle">${sh ? "Inviter quelqu'un d'autre" : "Identifiant de ton ami"}</label><div><input id="sh-handle" required placeholder="@pseudo" autocomplete="off" autocapitalize="none"><button class="pill" ${busy ? "disabled" : ""}>${busy ? "Un instant…" : "Inviter"}</button></div></form>
        ${msg ? `<p class="note err">${esc(msg)}</p>` : ""}
        ${sh ? `<button class="linkbtn danger" id="sh-leave">${sh.owner === cloud.user.id ? "Arrêter le partage pour tout le monde" : "Quitter le partage"}</button><p class="note">En partant, tu gardes les cartes qui sont (aussi) à toi.</p>` : ""}`;
    }
    el.innerHTML = `<div class="sheet shsheet" role="dialog" aria-modal="true" aria-label="Partager"><button class="iconbtn close" id="sh-close" aria-label="Fermer">${ICON.x}</button><h2>${PEOPLE} ${sharedOf(setId) ? "Extension partagée" : "Partager l'extension"}</h2>${body}</div>`;
    el.querySelector("#sh-close").onclick = close;
    el.querySelector("#sh-go")?.addEventListener("click", close);
    const f = el.querySelector("#sh-form");
    if (f) f.onsubmit = async e => {
      e.preventDefault(); const h = el.querySelector("#sh-handle").value; busy = true; msg = ""; draw();
      try { const who = await shareSet(setId, h); toast(`Invitation envoyée à ${who.name || "@" + who.handle}`); }
      catch (x) { msg = x.message || "Partage impossible"; }
      busy = false; draw(); redraw();
    };
    const lv = el.querySelector("#sh-leave");
    if (lv) lv.onclick = async () => {
      const own = sharedOf(setId)?.owner === cloud.user.id;
      if (!window.confirm(own ? "Arrêter le partage ? Chacun garde une copie des cartes." : "Quitter le partage de cette extension ?")) return;
      try { await leaveShare(setId); toast(own ? "Partage arrêté" : "Tu as quitté le partage"); close(); redraw(); } catch (x) { msg = x.message; draw(); }
    };
  }
  el.onclick = e => { if (e.target === el) close(); };
  addEventListener("shared:changed", draw); addEventListener("cloud:changed", draw);
  draw();
}
