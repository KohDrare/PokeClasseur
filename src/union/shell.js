import { DEX_NAMES } from "../data/dex-names.js";
import { eur } from "../features/variants.js";
import { $, ICON, esc } from "../lib/core.js";
import { setNav, toast } from "../lib/ui.js";
import { sprite } from "../pages/pokedex.js";
import { unFeed } from "./feed.js";
import { unListingPage, unMarket } from "./market.js";
import { unMessages } from "./messages.js";
import { unProfile } from "./profile.js";
import { UI, UN, unAgo, unAvatar, unBellCount, unCard, unCardImg, unName, unSave } from "./store.js";
import { unTrades } from "./trades.js";

/* ---------- shell ---------- */
export const UN_TABS = [["feed", "Fil", UI.home], ["market", "Marché", UI.tag], ["trades", "Échanges", UI.swap], ["messages", "Messages", UI.mail], ["profile", "Profil", UI.user]];
export function renderUnion(sub) {
  setNav("union");
  const parts = (sub || "feed").split("/");
  const tab = parts[0] === "u" ? (parts[1] === "me" ? "profile" : "u") : parts[0] === "listing" ? "market" : parts[0];
  const unread = UN.convos.reduce((a, c) => a + (c.unread || 0), 0);
  $("#app").innerHTML = `<section class="band unband"><div class="wrap">
      <div class="unhead"><div><div class="eyebrow">Échanger, vendre, partager</div><h1>Union Room</h1></div>
      <div class="unhead-r"><button class="iconbtn" id="un-bell" aria-label="Notifications">${UI.bell}<em hidden>0</em></button>${unAvatar(UN.me, 40)}</div></div>
      <nav class="untabs" aria-label="Union Room">${UN_TABS.map(([k, l, ic]) => `<a href="#/union/${k}" class="${tab === k ? "on" : ""}">${ic}<span>${l}</span>${k === "messages" && unread ? `<em>${unread}</em>` : ""}</a>`).join("")}</nav>
    </div></section>
    <div class="wrap unwrap"><div class="unmain" id="un-main"></div><aside class="unside" id="un-side"></aside></div>`;
  unBellCount();
  $("#un-bell").onclick = unOpenNotifs;
  const main = $("#un-main");
  if (tab === "feed") unFeed(main);
  else if (tab === "market") parts[0] === "listing" ? unListingPage(main, parts[1]) : unMarket(main);
  else if (tab === "trades") unTrades(main);
  else if (tab === "messages") unMessages(main, parts[1]);
  else if (tab === "profile") UN.me.name ? unProfile(main, "me") : unOnboard(main);
  else if (tab === "u") unProfile(main, parts[1]);
  unSide($("#un-side"), tab);
}
export function unSide(el, tab) {
  const sugg = Object.values(UN.users).filter(u => !UN.follows.includes(u.id) && !UN.blocked.includes(u.id)).slice(0, 3);
  const wantCount = new Map(); Object.values(UN.users).forEach(u => u.want.forEach(id => wantCount.set(id, (wantCount.get(id) || 0) + 1)));
  const hot = [...wantCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([id, n]) => ({ c: unCard(id), n })).filter(x => x.c);
  el.innerHTML = `
    <div class="ucard demo-note"><b>Version d'essai</b><p>Tes publications, annonces et échanges restent sur cet appareil. Les autres dresseurs sont des <span class="demo">exemples</span> en attendant le serveur.</p></div>
    ${sugg.length ? `<div class="ucard"><h3>Dresseurs à suivre</h3>${sugg.map(u => `<div class="urow">${unAvatar(u, 36)}<div class="urow-t"><div>${unName(u)}</div><small>${esc(u.city)} · ${u.trades} échanges</small></div><button class="pill ghost sm" data-follow="${u.id}">Suivre</button></div>`).join("")}</div>` : ""}
    <div class="ucard"><h3>Les plus recherchées</h3>${hot.map(({ c, n }) => `<div class="urow hot" data-card="${c.id}"><span class="hotimg">${unCardImg(c)}</span><div class="urow-t"><div class="ell">${esc(c.name)}</div><small>${esc(c.set)} · ${n} dresseur${n > 1 ? "s" : ""}</small></div><b>${eur(c.p)}</b></div>`).join("")}</div>
    <div class="ucard"><h3>${UI.shield} Échanger en sécurité</h3><ul class="tips"><li>Préfère la remise en main propre dans un lieu public, ou un envoi suivi.</li><li>Regarde la note et le nombre d'échanges du dresseur.</li><li>Garde toute la discussion dans les messages de l'Union Room.</li><li>Ne paie jamais par un moyen sans protection acheteur.</li></ul></div>`;
  el.querySelectorAll("[data-follow]").forEach(b => b.onclick = () => { unFollow(b.dataset.follow); renderUnion(location.hash.slice(8) || "feed"); });
  el.querySelectorAll(".hot").forEach(r => r.onclick = () => { location.hash = "#/union/market"; setTimeout(() => { const i = $("#mk-q"); if (i) { i.value = unCard(r.dataset.card).name; i.dispatchEvent(new Event("input")); } }, 50); });
}
export function unFollow(id) {
  if (UN.follows.includes(id)) UN.follows = UN.follows.filter(x => x !== id);
  else { UN.follows.push(id); toast(`Tu suis ${UN.users[id].name}`); }
  unSave();
}
export function unOpenNotifs() {
  const root = $("#modal-root");
  root.innerHTML = `<div class="modal" id="mdl"><div class="sheet notifsheet" role="dialog" aria-modal="true" aria-label="Notifications"><button class="iconbtn close" id="m-close" aria-label="Fermer">${ICON.x}</button>
    <div class="info"><h2>Notifications</h2><div class="notifs">${UN.notifs.length ? UN.notifs.map(n => `<a class="notif ${n.read ? "" : "new"}" href="${n.link || "#/union/feed"}"><span>${esc(n.text)}</span><small>${unAgo(n.ts)}</small></a>`).join("") : `<p class="note">Rien de neuf pour l'instant.</p>`}</div></div></div></div>`;
  document.body.style.overflow = "hidden";
  const close = () => { root.innerHTML = ""; document.body.style.overflow = ""; };
  $("#m-close").onclick = close; $("#mdl").onclick = e => { if (e.target.id === "mdl") close(); };
  root.querySelectorAll(".notif").forEach(a => a.onclick = close);
  UN.notifs.forEach(n => n.read = true); unSave(); unBellCount();
}

/* ---------- onboarding / profile edit ---------- */
export const UN_AVATARS = [25, 133, 6, 9, 3, 150, 151, 448, 282, 197, 196, 94, 143, 249, 384, 445, 658, 778, 887, 1007, 1008, 906, 909, 912, 491, 700];
export function unOnboard(main, editing) {
  const m = UN.me; let av = m.avatar || 25;
  main.innerHTML = `<div class="ucard onboard"><h2>${editing ? "Modifier mon profil" : "Crée ton profil de dresseur"}</h2>
    <p class="note">${editing ? "" : "C'est ce que les autres verront quand tu publies, vends ou proposes un échange."}</p>
    <div class="h3">Ton avatar</div><div class="avpick" id="ob-av">${UN_AVATARS.map(n => `<button class="${n === av ? "on" : ""}" data-n="${n}" aria-label="Avatar ${DEX_NAMES[n - 1]}"><img src="${sprite(n)}" alt="" loading="lazy"></button>`).join("")}</div>
    <div class="pgrid" style="margin-top:18px">
      <label>Pseudo<input id="ob-name" maxlength="24" value="${esc(m.name)}" placeholder="ex. Arthur"></label>
      <label>Identifiant<input id="ob-handle" maxlength="24" value="${esc(m.handle)}" placeholder="ex. arthur.dresseur"></label>
      <label>Ville<input id="ob-city" maxlength="40" value="${esc(m.city)}" placeholder="ex. Charleroi"></label>
      <label class="wide">Bio<input id="ob-bio" maxlength="140" value="${esc(m.bio)}" placeholder="Ce que tu collectionnes, ce que tu cherches…"></label>
    </div>
    <div class="acts" style="display:flex;gap:8px;margin-top:16px"><button class="pill" id="ob-save">${editing ? "Enregistrer" : "Entrer dans l'Union Room"}</button>${editing ? `<button class="pill ghost" id="ob-cancel">Annuler</button>` : ""}</div></div>`;
  $("#ob-av").onclick = e => { const b = e.target.closest("button"); if (!b) return; av = +b.dataset.n; [...e.currentTarget.children].forEach(x => x.classList.toggle("on", x === b)); };
  $("#ob-save").onclick = () => {
    const name = $("#ob-name").value.trim(); if (!name) { toast("Choisis un pseudo"); $("#ob-name").focus(); return; }
    Object.assign(m, { name, handle: ($("#ob-handle").value.trim() || name).toLowerCase().replace(/[^a-z0-9._]/g, ""), city: $("#ob-city").value.trim(), bio: $("#ob-bio").value.trim(), avatar: av });
    unSave(); toast(editing ? "Profil enregistré" : `Bienvenue ${name} !`);
    location.hash = editing ? "#/union/profile" : "#/union/feed"; if (editing) renderUnion("profile");
  };
  const c = $("#ob-cancel"); if (c) c.onclick = () => renderUnion("profile");
}
export const unNeedProfile = () => { if (UN.me.name) return false; toast("Crée d'abord ton profil"); location.hash = "#/union/profile"; return true; };
