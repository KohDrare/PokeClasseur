/* Real trainer profiles (Supabase): sign-up of the pseudo, public profile pages, follows, showcase, search.
   Only used when the cloud is configured; the demo trainers keep working as before. */
import { openAccount } from "../cloud/account.js";
import { HANDLE_RE, getProfileCard, handleTaken, listFollows, profileError, saveMyProfile, searchProfiles, setFollow, toHandle } from "../cloud/profiles.js";
import { cloud, hasProfile } from "../cloud/session.js";
import { DEX_NAMES } from "../data/dex-names.js";
import { eur } from "../features/variants.js";
import { $, ICON, esc } from "../lib/core.js";
import { toast } from "../lib/ui.js";
import { sprite } from "../pages/pokedex.js";
import { unBindPosts, unCardSheet, unPostHTML } from "./feed.js";
import { unPickCards } from "./picker.js";
import { UI, UN, unCardImg, unSyncMe } from "./store.js";

export const profileLink = handle => `#/union/u/@${encodeURIComponent(handle)}`;
const av = (p, size) => `<span class="uav" style="--s:${size}px"><img src="${sprite(p.avatar || 25)}" alt="" loading="lazy"></span>`;
const since = d => new Date(d).toLocaleDateString("fr-BE", { month: "long", year: "numeric" });
const loading = (txt = "Chargement…") => `<div class="empty-state" data-wait><b>${txt}</b></div>`;

export function personRow(p, extra = "") {
  return `<a class="urow person" href="${profileLink(p.handle)}">${av(p, 38)}<div class="urow-t"><div class="ell"><b>${esc(p.name || p.handle)}</b></div><small>@${esc(p.handle)}${p.city ? ` · ${esc(p.city)}` : ""}</small></div>${extra}</a>`;
}

/* ---------- not signed in ---------- */
export function unLoginInvite(main) {
  main.innerHTML = `<div class="ucard onboard invite">
    <div class="inv-av">${[25, 133, 6, 151, 448].map(n => `<img src="${sprite(n)}" alt="" loading="lazy">`).join("")}</div>
    <h2>Ton profil de dresseur</h2>
    <p class="note">Connecte-toi pour choisir ton pseudo et ton avatar, montrer ta vitrine et suivre d'autres collectionneurs. Ta collection reste synchronisée sur tous tes appareils.</p>
    <button class="pill" id="inv-login">${UI.user} Se connecter ou créer un compte</button></div>`;
  $("#inv-login").onclick = () => cloud.supabase ? openAccount() : toast("Connexion au serveur…");
}

/* ---------- choose / edit pseudo, avatar, city, bio ---------- */
const AVATARS = [25, 133, 6, 9, 3, 150, 151, 448, 282, 197, 196, 94, 143, 249, 384, 445, 658, 778, 887, 1007, 1008, 906, 909, 912, 491, 700];
export function unOnboardCloud(main, editing) {
  const p = cloud.profile || {};
  let avatar = p.avatar || 25, handleOk = !!p.handle, checkT = null, busy = false;
  const suggested = p.handle || toHandle((cloud.user?.email || "").split("@")[0]);
  main.innerHTML = `<div class="ucard onboard"><h2>${editing ? "Modifier mon profil" : "Crée ton profil de dresseur"}</h2>
    <p class="note">${editing ? "Ces informations sont visibles par tous les dresseurs." : "C'est ce que les autres verront quand tu publies, vends ou proposes un échange. Tu pourras tout modifier plus tard."}</p>
    ${p.error ? `<p class="note err">${esc(p.error)}</p>` : ""}
    <div class="h3">Ton avatar</div><div class="avpick" id="ob-av">${AVATARS.map(n => `<button type="button" class="${n === avatar ? "on" : ""}" data-n="${n}" aria-label="Avatar ${DEX_NAMES[n - 1]}"><img src="${sprite(n)}" alt="" loading="lazy"></button>`).join("")}</div>
    <form class="pgrid" id="ob-form" style="margin-top:18px">
      <label>Pseudo<span class="handle-in"><i>@</i><input id="ob-handle" maxlength="24" autocomplete="username" autocapitalize="none" spellcheck="false" value="${esc(suggested)}" placeholder="ex. arthur.dresseur" required></span><small class="hint" id="ob-hint">3 à 24 caractères : lettres, chiffres, point ou tiret bas.</small></label>
      <label>Nom affiché<input id="ob-name" maxlength="40" value="${esc(p.name || "")}" placeholder="ex. Arthur"></label>
      <label>Ville<input id="ob-city" maxlength="60" value="${esc(p.city || "")}" placeholder="ex. Charleroi"></label>
      <label class="wide">Bio<textarea id="ob-bio" maxlength="280" rows="3" placeholder="Ce que tu collectionnes, ce que tu cherches…">${esc(p.bio || "")}</textarea></label>
      <label class="wide check"><input type="checkbox" id="ob-show" ${p.show_collection === false ? "" : "checked"}><span><b>Montrer le résumé de ma collection</b><small>Nombre de cartes, d'extensions et de Pokémon sur ton profil. Le détail de tes cartes reste privé.</small></span></label>
      <div class="acts wide"><button class="pill" id="ob-save">${editing ? "Enregistrer" : "Créer mon profil"}</button>${editing ? `<button type="button" class="pill ghost" id="ob-cancel">Annuler</button>` : ""}</div>
      <p class="note err wide" id="ob-err" hidden></p>
    </form></div>`;
  const hint = $("#ob-hint"), inp = $("#ob-handle");
  const setHint = (txt, cls = "") => { hint.textContent = txt; hint.className = "hint " + cls; };
  const check = () => {
    const h = toHandle(inp.value); if (h !== inp.value) inp.value = h;
    clearTimeout(checkT); handleOk = false;
    if (!HANDLE_RE.test(h)) { setHint("3 à 24 caractères : lettres, chiffres, point ou tiret bas.", h ? "bad" : ""); return; }
    if (h === p.handle) { handleOk = true; setHint("C'est ton pseudo actuel.", "good"); return; }
    setHint("Vérification…");
    checkT = setTimeout(async () => {
      try { const taken = await handleTaken(h); if (inp.value !== h) return; handleOk = !taken; setHint(taken ? "Ce pseudo est déjà pris." : "Ce pseudo est libre.", taken ? "bad" : "good"); }
      catch (e) { setHint(profileError(e), "bad"); }
    }, 350);
  };
  inp.oninput = check; check();
  $("#ob-av").onclick = e => { const b = e.target.closest("button"); if (!b) return; avatar = +b.dataset.n; [...e.currentTarget.children].forEach(x => x.classList.toggle("on", x === b)); };
  $("#ob-form").onsubmit = async e => {
    e.preventDefault(); if (busy) return;
    const err = $("#ob-err"); err.hidden = true;
    const handle = toHandle(inp.value);
    if (!HANDLE_RE.test(handle)) { inp.focus(); setHint("3 à 24 caractères : lettres, chiffres, point ou tiret bas.", "bad"); return; }
    busy = true; $("#ob-save").disabled = true; $("#ob-save").textContent = "Enregistrement…";
    try {
      await saveMyProfile({ handle, avatar, name: $("#ob-name").value.trim() || null, city: $("#ob-city").value.trim() || null, bio: $("#ob-bio").value.trim() || null, show_collection: $("#ob-show").checked });
      unSyncMe();
      toast(editing ? "Profil enregistré" : `Bienvenue @${handle} !`);
      location.hash = "#/union/profile";
      dispatchEvent(new HashChangeEvent("hashchange"));
    } catch (x) {
      err.textContent = profileError(x); err.hidden = false;
      busy = false; $("#ob-save").disabled = false; $("#ob-save").textContent = editing ? "Enregistrer" : "Créer mon profil";
    }
  };
  const c = $("#ob-cancel"); if (c) c.onclick = () => { location.hash = "#/union/profile"; dispatchEvent(new HashChangeEvent("hashchange")); };
  if (!handleOk) inp.focus();
}

/* ---------- a trainer's page (mine or someone else's) ---------- */
export async function unCloudProfile(main, handle, myStats) {
  const mine = hasProfile() && handle === cloud.profile.handle;
  main.innerHTML = loading();
  let card;
  try { card = await getProfileCard(handle); }
  catch (e) { main.innerHTML = `<div class="empty-state"><b>Profil indisponible</b>${esc(profileError(e))}</div>`; return; }
  if (!card) { main.innerHTML = `<div class="empty-state"><b>Dresseur introuvable</b>Aucun profil @${esc(handle)}.</div>`; return; }
  if (!main.isConnected) return;
  const st = card.stats;
  const statBox = (n, l) => `<div><b>${n}</b><small>${l}</small></div>`;
  const stats = mine && myStats
    ? statBox(myStats.cards, "cartes") + statBox(eur(myStats.value) === "–" ? "0 €" : eur(myStats.value), "valeur") + statBox(`${myStats.dex}/1025`, "Pokédex")
    : st ? statBox(st.cards, "cartes") + statBox(st.sets, "extensions") + statBox(`${st.dex}/1025`, "Pokédex")
      : `<div class="wide2"><b>${UI.shield}</b><small>Collection privée</small></div>`;
  const showcase = Array.isArray(card.showcase) ? card.showcase : [];
  main.innerHTML = `<div class="ucard prof">
      <div class="pr-top">${av(card, 92)}<div class="pr-id"><h2>${esc(card.name || card.handle)}</h2>
        <div class="note">@${esc(card.handle)}${card.city ? ` · ${UI.pin} ${esc(card.city)}` : ""} · depuis ${since(card.joined)}</div>${card.bio ? `<p class="ptext">${esc(card.bio)}</p>` : ""}</div>
      <div class="pr-acts">${mine
        ? `<button class="pill ghost" id="pr-edit">Modifier le profil</button><button class="pill ghost" id="pr-share">${UI.send} Partager</button>`
        : `<button class="pill ${card.i_follow ? "ghost" : ""}" id="pr-follow">${card.i_follow ? "Abonné" : "Suivre"}</button><button class="pill ghost" disabled title="La messagerie en ligne arrive bientôt">${UI.mail} Message</button><button class="pill ghost" id="pr-share">${UI.send} Partager</button>`}</div></div>
      <div class="pr-stats c5">${stats}<button class="pr-f" data-t="followers"><b id="pr-nf">${card.followers}</b><small>abonné${card.followers > 1 ? "s" : ""}</small></button><button class="pr-f" data-t="following"><b>${card.following}</b><small>abonnement${card.following > 1 ? "s" : ""}</small></button></div>
    </div>
    <div class="seg prtabs" id="pr-tabs"><button data-t="show" class="on">Vitrine <em>${showcase.length}</em></button><button data-t="followers">Abonnés</button><button data-t="following">Abonnements</button>${mine ? `<button data-t="posts">Mes publications</button>` : ""}</div>
    <div id="pr-body"></div>`;
  const body = $("#pr-body");
  const tabs = {
    show: () => {
      body.innerHTML = `${mine ? `<div class="pr-bar"><span class="note">Les cartes que tu veux montrer en premier (12 maximum).</span><button class="pill ghost sm" id="pr-pick">${UI.cards} Choisir ma vitrine</button></div>` : ""}
        ${showcase.length ? `<div class="grid smallgrid">${showcase.map((c, i) => `<button class="tile owned stile" data-i="${i}"><span class="cardimg">${unCardImg(c)}</span><span class="cap"><span class="nm">${esc(c.name)}</span><span class="pr">${esc(c.set || "")}</span></span></button>`).join("")}</div>`
          : `<div class="empty-state"><b>Vitrine vide</b>${mine ? "Choisis jusqu'à 12 cartes de ta collection à mettre en avant." : `@${esc(card.handle)} n'a pas encore choisi de cartes.`}</div>`}`;
      body.querySelectorAll("[data-i]").forEach(b => b.onclick = () => unCardSheet(showcase[+b.dataset.i]));
      const pk = $("#pr-pick");
      if (pk) pk.onclick = () => unPickCards({ title: "Ma vitrine (12 cartes maximum)", only: "mine" }, async cs => {
        const next = [...cs, ...showcase.filter(o => !cs.some(c => c.id === o.id))].slice(0, 12)
          .map(c => ({ id: c.id, name: c.name, img: c.img, set: c.set, n: c.n, r: c.r || "", p: c.p || 0 }));
        try { await saveMyProfile({ showcase: next }); toast("Vitrine mise à jour"); }   // the page redraws itself on "cloud:changed"
        catch (e) { toast(profileError(e)); }
      });
    },
    followers: () => people("followers"),
    following: () => people("following"),
    posts: () => {
      const posts = UN.posts.filter(x => x.author === "me").sort((a, b) => b.ts - a.ts);
      body.innerHTML = posts.length ? posts.map(unPostHTML).join("") : `<div class="empty-state"><b>Aucune publication</b>Publie ton premier pull depuis le fil.</div>`;
      unBindPosts(body);
    }
  };
  const people = async dir => {
    body.innerHTML = loading();
    try {
      const list = await listFollows(card.id, dir);
      body.innerHTML = list.length ? `<div class="ucard plist">${list.map(p => personRow(p)).join("")}</div>`
        : `<div class="empty-state"><b>${dir === "followers" ? "Aucun abonné pour l'instant" : "Aucun abonnement pour l'instant"}</b>${mine && dir === "following" ? "Cherche des dresseurs dans la colonne de droite." : ""}</div>`;
    } catch (e) { body.innerHTML = `<div class="empty-state"><b>Liste indisponible</b>${esc(profileError(e))}</div>`; }
  };
  const select = t => { [...$("#pr-tabs").children].forEach(x => x.classList.toggle("on", x.dataset.t === t)); tabs[t](); };
  select("show");
  $("#pr-tabs").onclick = e => { const b = e.target.closest("button"); if (b) select(b.dataset.t); };
  main.querySelectorAll(".pr-f").forEach(b => b.onclick = () => select(b.dataset.t));
  $("#pr-share").onclick = async () => {
    const url = location.origin + location.pathname + profileLink(card.handle);
    try { if (navigator.share) await navigator.share({ title: `@${card.handle} sur PokéClasseur`, url }); else { await navigator.clipboard.writeText(url); toast("Lien du profil copié"); } }
    catch { /* partage annulé */ }
  };
  if (mine) $("#pr-edit").onclick = () => unOnboardCloud(main, true);
  else {
    const f = $("#pr-follow");
    f.onclick = async () => {
      if (!hasProfile()) { toast(cloud.user ? "Crée d'abord ton profil" : "Connecte-toi pour suivre des dresseurs"); location.hash = "#/union/profile"; return; }
      const on = !card.i_follow; f.disabled = true;
      try {
        await setFollow(card.id, on);
        card.i_follow = on; card.followers += on ? 1 : -1;
        f.textContent = on ? "Abonné" : "Suivre"; f.classList.toggle("ghost", on);
        $("#pr-nf").textContent = card.followers;
        if (on) toast(`Tu suis @${card.handle}`);
      } catch (e) { toast(profileError(e)); }
      f.disabled = false;
    };
  }
}

/* ---------- side column: find real trainers ---------- */
export function unFindPeople(el) {
  const box = document.createElement("div");
  box.className = "ucard findp";
  box.innerHTML = `<h3>${UI.user} Trouver des dresseurs</h3>
    <label class="search sm" for="fp-q">${ICON.search}<input id="fp-q" placeholder="Pseudo ou nom" autocomplete="off" autocapitalize="none"></label>
    <div id="fp-list">${loading()}</div>`;
  el.prepend(box);
  const list = box.querySelector("#fp-list"); let t = null, seq = 0;
  const run = async q => {
    const my = ++seq;
    try {
      const r = await searchProfiles(q, q ? 12 : 5);
      if (my !== seq) return;
      list.innerHTML = r.length ? `${q ? "" : `<small class="note">Nouveaux dresseurs</small>`}${r.map(p => personRow(p)).join("")}`
        : `<p class="note">${q ? "Aucun dresseur trouvé." : "Tu es parmi les premiers : invite tes amis collectionneurs !"}</p>`;
    } catch (e) { if (my === seq) list.innerHTML = `<p class="note err">${esc(profileError(e))}</p>`; }
  };
  box.querySelector("#fp-q").oninput = e => { clearTimeout(t); const q = e.target.value; t = setTimeout(() => run(q), 300); };
  if (cloud.supabase) run(""); else list.innerHTML = `<p class="note">Connexion au serveur…</p>`;
}

/* follows of the demo trainers stay local; this only says whether the "Profil" tab can show something */
export const unProfileState = () => !cloud.ready || (cloud.user && !cloud.profile) ? "wait" : !cloud.user ? "guest" : !cloud.profile.handle ? "new" : "ok";
