/* "Profil" tab (in place of the Union Room for now): who I am, my account and its sync,
   my collection in figures, saving / exporting the collection, and the app settings. */
/* global __BUILD__ */
import { $, esc } from "../lib/core.js";
import { setNav, toast } from "../lib/ui.js";
import { cloud } from "../cloud/session.js";
import { HANDLE_RE, handleTaken, saveMyProfile, toHandle } from "../cloud/profiles.js";
import { S } from "../state/shared.js";
import { COND_F, LANGS, ownedBySet } from "../state/collection.js";
import { PREF, applyGray, applyTheme, savePref } from "../state/prefs.js";
import { dexCounts, sprite } from "./pokedex.js";
import { collectionValue } from "./home.js";
import { loadSet, peekSet } from "../data/tcgdex.js";
import { VARIANT_LABEL, eur, priceOf } from "../features/variants.js";
import { askMotion } from "../features/tilt.js";
import { SH, acceptInvite, activeMembers, declineInvite } from "../cloud/shared.js";
import { avatarImg } from "../features/sharesheet.js";
import { drawTrainerSearch, renderTrainer, trainerLink } from "./trainer.js";
import { openSync } from "../features/sync.js";

const AVATARS = [25, 133, 6, 9, 3, 150, 151, 448, 282, 197, 196, 94, 143, 249, 384, 445, 658, 778, 887, 1007, 1008, 906, 909, 912, 491, 700];
let acctMod = null;
const account = () => acctMod ||= import("../cloud/account.js");

/* signed in with a pseudo: the tab opens on my public page (vitrine, collection, followers…) with my settings
   below; otherwise the settings page alone */
let mode = "plain", sig = "";
const profSig = () => JSON.stringify(cloud.profile || null);
export async function renderProfile() {
  setNav("profil");
  const grid = `<div class="pf-grid">
      <div class="pf-col">
        <div class="pf-card" id="pf-me"></div>
        <div class="pf-card" id="pf-people" hidden></div>
        <div class="pf-card" id="pf-share" hidden></div>
        <div class="pf-card" id="pf-acct"></div>
      </div>
      <div class="pf-col">
        <div class="pf-card" id="pf-col"></div>
        <div class="pf-card" id="pf-save"></div>
        <div class="pf-card" id="pf-set"></div>
      </div>
    </div>
    <p class="note pf-ver">PokéClasseur · version du ${new Date(__BUILD__).toLocaleString("fr-BE", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}</p>`;
  sig = profSig();
  const handle = cloud.user && cloud.profile?.handle;
  const own = handle ? await renderTrainer(handle, { own: true, after: grid }) : false;
  if (!location.hash.startsWith("#/profil")) return;
  if (!own) $("#app").innerHTML = `<section class="profile-page"><div id="pf-head"></div>${grid}</section>`;
  mode = own ? "own" : "plain";
  drawHead(); drawMe(); drawAcct(); drawShare(); drawCol(); drawSave(); drawSettings(); if (mode !== "own") drawTrainerSearch($("#pf-people"));
  const onShared = () => { if (!$("#pf-share")) return removeEventListener("shared:changed", onShared); drawShare(); };
  addEventListener("shared:changed", onShared);
  const onCloud = () => {
    if (!$("#pf-me")) return off();
    const editing = !!$("#pf-me form.pf-edit");
    // signed in / out, pseudo chosen, profile changed: the page itself changes
    if (!editing && ((mode === "plain" && cloud.user && cloud.profile?.handle) || (mode === "own" && (!cloud.user || profSig() !== sig)))) { off(); removeEventListener("shared:changed", onShared); return renderProfile(); }
    drawHead(); drawAcct(); if (!editing) drawMe(); if (mode !== "own" && $("#pf-people")?.hidden) drawTrainerSearch($("#pf-people"));
  };
  const off = () => removeEventListener("account:status", onCloud);
  addEventListener("account:status", onCloud);
}

const signedIn = () => !!(cloud.enabled && cloud.user);
const meName = () => cloud.profile?.name || cloud.profile?.handle || cloud.user?.email?.split("@")[0] || "Dresseur";

function drawHead() {
  const el = $("#pf-head"); if (!el) return;
  const p = cloud.profile;
  el.innerHTML = `<div class="pf-hero">
    <img class="pf-av" src="${sprite(p?.avatar || 25)}" alt="">
    <div class="pf-id">
      <h1>${signedIn() ? esc(meName()) : "Mon profil"}</h1>
      <div class="note">${signedIn() ? `${p?.handle ? `@${esc(p.handle)} · ` : ""}${esc(cloud.user.email)}` : cloud.enabled ? "Pas connecté : ta collection est enregistrée sur cet appareil seulement." : "Ta collection est enregistrée sur cet appareil."}</div>
    </div>
  </div>`;
}

/* ---------- my trainer profile ---------- */
function drawMe(editing = false) {
  const el = $("#pf-me"); if (!el) return;
  if (!cloud.enabled) { el.hidden = true; return; }
  if (!signedIn()) {
    el.innerHTML = `<h2>Mon compte</h2>
      <p class="note">Connecte-toi avec le même compte sur ton téléphone et ton ordinateur : ta collection se met à jour partout, toute seule.</p>
      <div class="acts"><button class="pill" id="pf-login">Se connecter</button><button class="pill ghost" id="pf-signup">Créer un compte</button></div>`;
    $("#pf-login").onclick = () => openAcc("login");
    $("#pf-signup").onclick = () => openAcc("signup");
    return;
  }
  const p = cloud.profile || {};
  if (!editing) {
    el.innerHTML = `<h2>Mon profil de dresseur</h2>
      ${p.handle ? `<dl class="pf-dl"><dt>Pseudo</dt><dd>${esc(p.name || "–")}</dd><dt>Identifiant</dt><dd>@${esc(p.handle)}</dd>${p.city ? `<dt>Ville</dt><dd>${esc(p.city)}</dd>` : ""}${p.bio ? `<dt>Bio</dt><dd>${esc(p.bio)}</dd>` : ""}</dl>`
        : `<p class="note">${p.error ? esc(p.error) : "Choisis un pseudo et un avatar : ils serviront plus tard pour les échanges entre dresseurs."}</p>`}
      <div class="acts"><button class="pill ${p.handle ? "ghost" : ""}" id="pf-edit">${p.handle ? "Modifier" : "Créer mon profil"}</button>${p.handle ? `<button class="pill ghost" id="pf-show">Choisir ma vitrine</button>${mode === "own" ? "" : `<a class="pill ghost" href="${trainerLink(p.handle)}">Voir mon profil public</a>`}` : ""}</div>
      ${p.handle ? `<div class="pf-rows" style="margin-top:12px"><button class="pf-row pf-sw ${p.show_collection ? "on" : ""}" id="pf-pub" role="switch" aria-checked="${!!p.show_collection}"><span><b>Collection visible par les autres</b><small>Ton nombre de cartes, d'extensions et de Pokémon sur ton profil public</small></span><i></i></button></div>` : ""}`;
    $("#pf-edit").onclick = () => drawMe(true);
    const pub = $("#pf-pub");
    if (pub) pub.onclick = async () => { pub.disabled = true; try { await saveMyProfile({ show_collection: !p.show_collection }); toast(p.show_collection ? "Ta collection est privée" : "Ta collection est visible sur ton profil"); } catch (x) { toast(x.message || "Impossible pour le moment"); } drawMe(); };
    const sw = $("#pf-show");
    if (sw) sw.onclick = async () => {
      const { unPickCards } = await import("../union/picker.js");
      const cur = Array.isArray(p.showcase) ? p.showcase : [];
      unPickCards({ title: "Ma vitrine (12 cartes maximum)", only: "mine" }, async cs => {
        const next = [...cs, ...cur.filter(o => !cs.some(c => c.id === o.id))].slice(0, 12).map(c => ({ id: c.id, name: c.name, img: c.img, set: c.set, n: c.n, r: c.r || "", p: c.p || 0 }));
        try { await saveMyProfile({ showcase: next }); toast("Vitrine mise à jour"); } catch (x) { toast(x.message || "Impossible pour le moment"); }
      });
    };
    return;
  }
  let av = p.avatar || 25;
  el.innerHTML = `<h2>${p.handle ? "Modifier mon profil" : "Créer mon profil"}</h2>
    <form class="pf-edit">
      <div class="pf-lbl">Avatar</div>
      <div class="avpick" id="pf-av">${AVATARS.map(n => `<button type="button" class="${n === av ? "on" : ""}" data-n="${n}"><img src="${sprite(n)}" alt="" loading="lazy"></button>`).join("")}</div>
      <label>Pseudo<input id="pf-name" maxlength="40" required value="${esc(p.name || "")}" placeholder="ex. Arthur"></label>
      <label>Identifiant<input id="pf-handle" maxlength="24" required value="${esc(p.handle || "")}" placeholder="ex. arthur.dresseur"><small>3 à 24 caractères : lettres minuscules, chiffres, point ou _</small></label>
      <label>Ville<input id="pf-city" maxlength="60" value="${esc(p.city || "")}" placeholder="ex. Charleroi"></label>
      <label>Bio<input id="pf-bio" maxlength="280" value="${esc(p.bio || "")}" placeholder="Ce que tu collectionnes, ce que tu cherches…"></label>
      <p class="note err" id="pf-err"></p>
      <div class="acts"><button class="pill" id="pf-ok">Enregistrer</button><button type="button" class="pill ghost" id="pf-cancel">Annuler</button></div>
    </form>`;
  $("#pf-av").onclick = e => { const b = e.target.closest("button"); if (!b) return; av = +b.dataset.n; [...e.currentTarget.children].forEach(x => x.classList.toggle("on", x === b)); };
  $("#pf-name").oninput = e => { const h = $("#pf-handle"); if (!p.handle && !h.dataset.touched) h.value = toHandle(e.target.value); };
  $("#pf-handle").oninput = e => { e.target.dataset.touched = 1; };
  $("#pf-cancel").onclick = () => drawMe();
  el.querySelector("form").onsubmit = async e => {
    e.preventDefault();
    const handle = $("#pf-handle").value.trim().toLowerCase(), err = $("#pf-err");
    if (!HANDLE_RE.test(handle)) { err.textContent = "Identifiant : 3 à 24 caractères, lettres minuscules, chiffres, point ou _."; return; }
    const ok = $("#pf-ok"); ok.disabled = true; err.textContent = "";
    try {
      if (await handleTaken(handle)) { err.textContent = "Cet identifiant est déjà pris."; ok.disabled = false; return; }
      await saveMyProfile({ handle, name: $("#pf-name").value.trim(), city: $("#pf-city").value.trim() || null, bio: $("#pf-bio").value.trim() || null, avatar: av });
      toast("Profil enregistré"); if (mode === "own") return renderProfile(); drawMe(); drawHead();
    } catch (x) { err.textContent = x.message || "Enregistrement impossible"; ok.disabled = false; }
  };
}

/* ---------- shared extensions: invitations and the ones I'm in ---------- */
function drawShare() {
  const el = $("#pf-share"); if (!el) return;
  const mine = Object.values(SH.bySet), inv = SH.invites;
  if (!signedIn() || (!mine.length && !inv.length)) { el.hidden = true; return; }
  el.hidden = false;
  const setName = id => (S.SERIES || []).flatMap(x => x.sets).find(t => t.id === id)?.name || id;
  el.innerHTML = `<h2>Extensions partagées</h2>
    ${inv.map(i => `<div class="pf-inv" data-id="${i.id}">${avatarImg({ profile: i.by }, "shav lg")}<div><b>${esc(i.by?.name || (i.by?.handle ? "@" + i.by.handle : "Quelqu'un"))}</b> t'invite à partager <b>${esc(setName(i.setId))}</b><small>Vos cartes de cette extension seront réunies dans une seule liste.</small><div class="acts"><button class="pill" data-acc="${i.id}">Accepter</button><button class="pill ghost" data-dec="${i.id}">Refuser</button></div></div></div>`).join("")}
    ${mine.map(sh => `<a class="pf-row pf-shset" href="#/set/${encodeURIComponent(sh.setId)}"><b>${esc(setName(sh.setId))}</b><span class="pf-avs">${activeMembers(sh).map(m => avatarImg(m)).join("")}</span><small>${activeMembers(sh).length} membre${activeMembers(sh).length > 1 ? "s" : ""} · ${sh.items.size} carte${sh.items.size > 1 ? "s" : ""} (versions)</small></a>`).join("")}`;
  el.onclick = async e => {
    const a = e.target.closest("[data-acc]"), d = e.target.closest("[data-dec]"); if (!a && !d) return;
    (a || d).disabled = true;
    try { if (a) { await acceptInvite(a.dataset.acc); toast("Partage accepté : l'extension est commune"); } else { await declineInvite(d.dataset.dec); toast("Invitation refusée"); } }
    catch (x) { toast(x.message || "Impossible pour le moment"); (a || d).disabled = false; }
  };
}

/* ---------- account and sync ---------- */
async function drawAcct() {
  const el = $("#pf-acct"); if (!el) return;
  if (!cloud.enabled || !signedIn()) { el.hidden = true; return; }
  el.hidden = false;
  const { acct } = await account();
  const st = acct.status || {};
  el.innerHTML = `<h2>Connexion et synchronisation</h2>
    <div class="acc-status st-${st.status}"><i></i><div><b>${esc(acct.statusText())}</b><small>${st.at ? `Dernière synchro à ${new Date(st.at).toLocaleTimeString("fr-BE", { hour: "2-digit", minute: "2-digit" })} · ` : ""}les changements arrivent tout seuls sur tes autres appareils</small>${st.status === "error" ? `<small class="err">${esc(st.error)}</small>` : ""}</div></div>
    <dl class="pf-dl"><dt>E-mail</dt><dd>${esc(cloud.user.email)}</dd><dt>Compte créé</dt><dd>${cloud.user.created_at ? new Date(cloud.user.created_at).toLocaleDateString("fr-BE", { day: "numeric", month: "long", year: "numeric" }) : "–"}</dd></dl>
    <form class="pf-pw"><label>Mot de passe<input id="pf-pw" type="password" minlength="6" required autocomplete="new-password" placeholder="Nouveau mot de passe (6 caractères minimum)"></label><button class="pill ghost">Changer le mot de passe</button></form>
    <div class="acts"><button class="pill" id="pf-sync">Synchroniser maintenant</button><button class="pill ghost" id="pf-out">Se déconnecter</button></div>`;
  $("#pf-sync").onclick = () => acct.syncNow();
  $("#pf-out").onclick = async () => { await acct.signOut(); renderProfile(); };
  el.querySelector(".pf-pw").onsubmit = async e => {
    e.preventDefault(); const pw = $("#pf-pw").value;
    try { await acct.setPassword(pw); $("#pf-pw").value = ""; toast("Mot de passe enregistré"); } catch (x) { toast(x.message); }
  };
}
async function openAcc(mode) {
  if (!cloud.supabase) { toast("Connexion au serveur…"); return; }
  const { openAccount } = await account(); openAccount(mode);
}

/* ---------- my collection in figures ---------- */
async function drawCol() {
  const el = $("#pf-col"); if (!el) return;
  const by = ownedBySet();
  const cards = Object.values(by).reduce((a, b) => a + b.cards, 0);
  const copies = Object.values(S.COL.cards).reduce((a, e) => a + Object.values(e.v).reduce((x, y) => x + y, 0), 0);
  const favs = Object.values(S.COL.cards).filter(e => e.f).length;
  const langs = Object.values(S.COL.cards).reduce((m, e) => { m[e.l || "FR"] = (m[e.l || "FR"] || 0) + 1; return m; }, {});
  el.innerHTML = `<h2>Ma collection</h2>
    <div class="pf-stats">
      <a href="#/collection"><b>${cards.toLocaleString("fr-BE")}</b><small>cartes différentes</small></a>
      <a href="#/collection"><b>${copies.toLocaleString("fr-BE")}</b><small>exemplaires</small></a>
      <a href="#/"><b>${Object.keys(by).length}</b><small>extensions</small></a>
      <a href="#/collection"><b id="pf-val">…</b><small>valeur estimée</small></a>
      <a href="#/pokedex"><b>${dexCounts().size}</b><small>Pokémon / 1025</small></a>
      <a href="#/collection"><b>${favs}</b><small>favoris</small></a>
    </div>
    <div class="note pf-langs">${Object.entries(langs).map(([k, n]) => `${LANGS[k]?.flag || ""} ${n} ${(LANGS[k]?.l || k).toLowerCase()}`).join(" · ")}</div>`;
  const v = await collectionValue(); const vEl = $("#pf-val"); if (vEl) vEl.textContent = eur(v) === "–" ? "0 €" : eur(v);
}

/* ---------- saving and exporting ---------- */
function download(name, text, type) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
const today = () => new Date().toISOString().slice(0, 10);
async function exportCSV() {
  const COND = { NM: "Comme neuve", EX: "Très bon état", GD: "Bon état", LP: "Légèrement jouée", PL: "Jouée", PO: "Abîmée" };
  const rows = [["Extension", "Numéro", "Carte", "Rareté", "Version", "Quantité", "État", "Langue", "Favori", "Prix unitaire estimé (€)"]];
  const bySet = {};
  for (const [id, e] of Object.entries(S.COL.cards)) (bySet[e.s] ||= []).push([id, e]);
  for (const [sid, arr] of Object.entries(bySet)) {
    const s = (await peekSet(sid).catch(() => null)) || (await loadSet(sid).catch(() => null));
    const m = new Map((s?.cards || []).map(c => [c.id, c]));
    for (const [id, e] of arr) {
      const c = m.get(id);
      for (const [v, n] of Object.entries(e.v)) if (n > 0) rows.push([s?.info?.name || sid, c?.n || id.slice(id.lastIndexOf("-") + 1), c?.name || id, c?.r || "", VARIANT_LABEL[v] || v, n, COND[e.c || "NM"], LANGS[e.l || "FR"]?.l || "", e.f ? "oui" : "", c ? (priceOf(c, v) * (COND_F[e.c] || 1)).toFixed(2).replace(".", ",") : ""]);
    }
  }
  const cell = x => { const t = String(x ?? ""); return /[;"\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
  download(`pokeclasseur-${today()}.csv`, "﻿" + rows.map(r => r.map(cell).join(";")).join("\r\n"), "text/csv;charset=utf-8");
}
function drawSave() {
  const el = $("#pf-save"); if (!el) return;
  el.innerHTML = `<h2>Sauvegarde et export</h2>
    <p class="note">${signedIn() ? "Ta collection est déjà enregistrée dans ton compte. Tu peux aussi en garder une copie." : "Garde une copie de ta collection, ou passe-la sur un autre appareil."}</p>
    <div class="pf-rows">
      <button class="pf-row" id="pf-csv"><b>Exporter en tableur</b><small>Fichier CSV pour Excel ou Numbers : extension, numéro, carte, version, quantité, état, langue, prix</small></button>
      <button class="pf-row" id="pf-json"><b>Exporter une sauvegarde</b><small>Fichier PokéClasseur à réimporter plus tard, ici ou sur un autre appareil</small></button>
      <button class="pf-row" id="pf-imp"><b>Importer ou transférer</b><small>Reprendre une sauvegarde ou un code copié sur un autre appareil</small></button>
    </div>`;
  $("#pf-csv").onclick = () => exportCSV().then(() => toast("Tableur exporté"));
  $("#pf-json").onclick = () => { download(`pokeclasseur-${today()}.json`, JSON.stringify({ app: "pokeclasseur", v: 1, ...S.COL }, null, 1), "application/json"); toast("Sauvegarde exportée"); };
  $("#pf-imp").onclick = openSync;
}

/* ---------- settings ---------- */
function drawSettings() {
  const el = $("#pf-set"); if (!el) return;
  const m = document.documentElement.classList.contains("m"), mAble = m || document.documentElement.classList.contains("m-able");
  const sw = (id, on, t, d) => `<button class="pf-row pf-sw ${on ? "on" : ""}" id="${id}" role="switch" aria-checked="${on}"><span><b>${t}</b><small>${d}</small></span><i></i></button>`;
  el.innerHTML = `<h2>Réglages</h2>
    <div class="pf-rows">
      ${sw("pf-dark", PREF.theme === "dark", "Mode sombre", "Fond foncé, plus doux le soir")}
      ${"DeviceOrientationEvent" in window && matchMedia("(pointer:coarse)").matches ? `<button class="pf-row" id="pf-motion"><b>Effet 3D avec le mouvement</b><small>Autoriser l'inclinaison du téléphone pour faire bouger les cartes</small></button>` : ""}
      ${mAble ? `<button class="pf-row" id="pf-ui"><b>${m ? "Version ordinateur" : "Version téléphone"}</b><small>${m ? "Afficher le site comme sur un ordinateur" : "Revenir à l'affichage pour téléphone"}</small></button>` : ""}
    </div>`;
  $("#pf-dark").onclick = e => { PREF.theme = PREF.theme === "dark" ? "light" : "dark"; savePref(); applyTheme(); flip(e.currentTarget, PREF.theme === "dark"); };
  const mo = $("#pf-motion"); if (mo) mo.onclick = () => { askMotion(); toast("Incline ton téléphone sur une carte en grand"); };
  const ui = $("#pf-ui"); if (ui) ui.onclick = () => { try { localStorage.setItem("pc-ui", m ? "d" : "m"); } catch { /* private mode */ } location.reload(); };
}
const flip = (b, on) => { b.classList.toggle("on", on); b.setAttribute("aria-checked", on); };
