/* Account button + sign-in window (e-mail link or 6-digit code, no password). */
import { cloudEnabled } from "./config.js";
import { loadMyProfile, profileError } from "./profiles.js";
import { cloud, setCloud } from "./session.js";
import { $, esc, ICON } from "../lib/core.js";
import { toast } from "../lib/ui.js";
import { sprite } from "../pages/pokedex.js";
import { S } from "../state/shared.js";

let session = null;
let supabase, startSync, stopSync, syncState = { status: "off" }, onSyncState = () => () => {}, queuePush;   // filled once the cloud code is loaded
let openModal = null, closeModal = null;   // redraw function of the account window while it is open
const btn = $("#btn-account");

const friendly = m => /fetch|network/i.test(m || "") ? "Impossible de joindre le serveur. Vérifie ta connexion et réessaie."
  : /rate|seconds/i.test(m || "") ? "Trop de demandes : attends une minute avant de réessayer."
  : /invalid login/i.test(m || "") ? "E-mail ou mot de passe incorrect."
  : /not confirmed/i.test(m || "") ? "Adresse pas encore confirmée : clique d'abord sur le lien reçu par e-mail (une seule fois)."
  : /already registered|already exists/i.test(m || "") ? "Un compte existe déjà avec cette adresse : connecte-toi avec ton mot de passe."
  : /password.*(6|least|short)/i.test(m || "") ? "Le mot de passe doit faire au moins 6 caractères."
  : m;
let recovering = false;   // opened from the "new password" e-mail
const STATUS_TEXT = { off: "Non connecté", syncing: "Synchronisation…", ok: "Collection synchronisée", error: "Erreur de synchronisation", offline: "Hors ligne : la synchro reprendra au retour du réseau" };

const BTN_ICON = btn ? btn.innerHTML : "";
function paintButton() {
  dispatchEvent(new CustomEvent("account:status"));
  if (!btn) return;
  const p = cloud.profile;
  btn.dataset.state = session ? syncState.status : "off";
  btn.title = session ? `${p?.handle ? "@" + p.handle : session.user.email} · ${STATUS_TEXT[syncState.status]}` : "Se connecter";
  const face = session && p?.handle ? `<img class="acc-av" src="${sprite(p.avatar || 25)}" alt="">` : BTN_ICON;
  if (btn.innerHTML !== face) btn.innerHTML = face;
}
addEventListener("cloud:changed", () => { paintButton(); openModal?.(); });

/* what the profile page needs, without knowing about Supabase */
export const acct = {
  get session() { return session; },
  get status() { return syncState; },
  statusText: () => STATUS_TEXT[syncState.status] || "",
  syncNow: () => session && startSync(session.user.id),
  async signOut() { await supabase.auth.signOut(); toast("Déconnecté. Ta collection reste sur cet appareil."); },
  async setPassword(password) { const { error } = await supabase.auth.updateUser({ password }); if (error) throw new Error(friendly(error.message)); }
};
export function openAccount(mode) {
  const root = $("#modal-root");
  let step = recovering ? "newpass" : mode || "login", email = "", busy = false, msg = "", info = "";
  const close = () => { root.innerHTML = ""; document.body.style.overflow = ""; document.removeEventListener("keydown", key); off(); openModal = closeModal = null; };
  closeModal = close;
  const key = e => { if (e.key === "Escape") close(); };
  const off = onSyncState(() => session && draw());
  document.addEventListener("keydown", key); document.body.style.overflow = "hidden";

  const draw = () => {
    const n = Object.keys(S.COL.cards).length;
    const body = session && step !== "newpass" ? `
      <h2>Mon compte</h2>
      <p class="note">${esc(session.user.email)}</p>
      ${cloud.profile?.handle
        ? `<a class="acc-prof" href="#/profil" id="acc-prof"><img src="${sprite(cloud.profile.avatar || 25)}" alt=""><span><b>${esc(cloud.profile.name || cloud.profile.handle)}</b><small>@${esc(cloud.profile.handle)} · voir mon profil</small></span></a>`
        : `<a class="acc-prof new" href="#/profil" id="acc-prof"><span><b>Crée ton profil de dresseur</b><small>Choisis ton pseudo et ton avatar</small></span></a>`}
      <div class="acc-status st-${syncState.status}"><i></i><div><b>${STATUS_TEXT[syncState.status]}</b><small>${n} carte${n > 1 ? "s" : ""} dans ta collection${syncState.at ? ` · dernière synchro ${new Date(syncState.at).toLocaleTimeString("fr-BE", { hour: "2-digit", minute: "2-digit" })}` : ""}</small>${syncState.status === "error" ? `<small class="err">${esc(syncState.error)}</small>` : ""}</div></div>
      <p class="note">Ta collection et tes achats sont enregistrés dans ton compte : connecte-toi sur un autre appareil pour les retrouver.</p>
      <div class="acts"><button class="pill" id="acc-sync">Synchroniser maintenant</button><button class="pill ghost" id="acc-out">Se déconnecter</button></div>
      <form id="acc-setpw" class="acc-form acc-setpw"><label for="acc-pw3">Mot de passe du compte <small>pour te connecter sans e-mail sur tes autres appareils</small></label><input id="acc-pw3" type="password" minlength="6" required autocomplete="new-password" placeholder="Nouveau mot de passe (6 caractères minimum)"><button class="pill ghost" ${busy ? "disabled" : ""}>${busy ? "Un instant…" : "Enregistrer le mot de passe"}</button></form>
      ${msg ? `<p class="note err">${esc(msg)}</p>` : ""}`
    : step === "login" || step === "signup" ? `
      <h2>${step === "login" ? "Se connecter" : "Créer un compte"}</h2>
      <p class="note">${step === "login" ? "Connecte-toi avec le même compte sur ton téléphone et ton ordinateur : ta collection se met à jour partout." : "Choisis ton adresse e-mail et un mot de passe. Ta collection actuelle sera ajoutée à ton compte."}</p>
      <form id="acc-pass" class="acc-form">
        <label for="acc-email">Adresse e-mail</label><input id="acc-email" type="email" autocomplete="email" required value="${esc(email)}" placeholder="toi@exemple.be">
        <label for="acc-pw">Mot de passe</label><input id="acc-pw" type="password" minlength="6" required autocomplete="${step === "login" ? "current-password" : "new-password"}" placeholder="${step === "login" ? "" : "6 caractères minimum"}">
        <button class="pill" ${busy ? "disabled" : ""}>${busy ? "Un instant…" : step === "login" ? "Se connecter" : "Créer mon compte"}</button></form>
      ${msg ? `<p class="note err">${esc(msg)}</p>` : ""}${info ? `<p class="note ok">${info}</p>` : ""}
      <div class="acc-links">
        <button class="linkbtn" id="acc-mode">${step === "login" ? "Pas encore de compte ? Créer un compte" : "J'ai déjà un compte : me connecter"}</button>
        ${step === "login" ? `<button class="linkbtn" id="acc-forgot">Mot de passe oublié</button>` : ""}
        <button class="linkbtn" id="acc-magic">Recevoir plutôt un lien par e-mail</button>
      </div>`
    : step === "newpass" ? `
      <h2>Nouveau mot de passe</h2>
      <form id="acc-new" class="acc-form"><label for="acc-pw2">Nouveau mot de passe</label><input id="acc-pw2" type="password" minlength="6" required autocomplete="new-password" placeholder="6 caractères minimum"><button class="pill" ${busy ? "disabled" : ""}>${busy ? "Un instant…" : "Enregistrer"}</button></form>
      ${msg ? `<p class="note err">${esc(msg)}</p>` : ""}`
    : step === "email" ? `
      <h2>Lien de connexion</h2>
      <p class="note">On t'envoie un lien de connexion par e-mail. Sur iPhone, le lien s'ouvre dans Safari : si tu utilises l'app depuis l'écran d'accueil, connecte-toi plutôt avec un mot de passe.</p>
      <form id="acc-form" class="acc-form"><label for="acc-email">Adresse e-mail</label><input id="acc-email" type="email" autocomplete="email" required value="${esc(email)}" placeholder="toi@exemple.be"><button class="pill" ${busy ? "disabled" : ""}>${busy ? "Envoi…" : "Recevoir le lien"}</button></form>
      ${msg ? `<p class="note err">${esc(msg)}</p>` : ""}
      <button class="linkbtn" id="acc-back">Me connecter avec un mot de passe</button>`
    : `
      <h2>Vérifie tes e-mails</h2>
      <p class="note">Un e-mail a été envoyé à <b>${esc(email)}</b>. Clique sur le lien qu'il contient pour te connecter. Si l'e-mail contient aussi un code à 6 chiffres, tu peux le taper ici.</p>
      <form id="acc-code" class="acc-form"><label for="acc-otp">Code</label><input id="acc-otp" inputmode="numeric" autocomplete="one-time-code" maxlength="8" required placeholder="123456"><button class="pill" ${busy ? "disabled" : ""}>${busy ? "Vérification…" : "Valider"}</button></form>
      ${msg ? `<p class="note err">${esc(msg)}</p>` : ""}
      <button class="linkbtn" id="acc-back">Me connecter avec un mot de passe</button>`;
    root.innerHTML = `<div class="modal" id="mdl"><div class="sheet formsheet acc" role="dialog" aria-modal="true" aria-label="Compte"><button class="iconbtn close" id="m-close" aria-label="Fermer">${ICON.x}</button><div class="info">${body}</div></div></div>`;
    $("#m-close").onclick = close; $("#mdl").onclick = e => { if (e.target.id === "mdl") close(); };
    const f = $("#acc-form");
    if (f) { $("#acc-email").focus(); f.onsubmit = async e => {
      e.preventDefault(); email = $("#acc-email").value.trim(); busy = true; msg = ""; draw();
      const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: location.origin + location.pathname } });
      busy = false; if (error) msg = friendly(error.message); else step = "code"; draw();
    }; }
    const redirect = location.origin + location.pathname;
    const pf = $("#acc-pass");
    if (pf) { (email ? $("#acc-pw") : $("#acc-email")).focus(); pf.onsubmit = async e => {
      e.preventDefault(); email = $("#acc-email").value.trim(); const password = $("#acc-pw").value; busy = true; msg = ""; info = ""; draw();
      if (step === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        busy = false; if (error) msg = friendly(error.message); draw();
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: redirect } });
        busy = false;
        if (error) msg = friendly(error.message);
        // an account made earlier with the e-mail link: Supabase says nothing and sends no e-mail
        else if (data.user && !data.user.identities?.length) { step = "login"; msg = "Un compte existe déjà avec cette adresse, sans mot de passe. Connecte-toi une fois avec « Recevoir plutôt un lien par e-mail », puis choisis ton mot de passe dans « Mon compte »."; }
        else if (!data.session) { step = "login"; info = `Compte créé. Clique une fois sur le lien de confirmation envoyé à <b>${esc(email)}</b>, puis connecte-toi ici avec ton mot de passe.`; }
        draw();
      }
    }; }
    const md = $("#acc-mode"); if (md) md.onclick = () => { step = step === "login" ? "signup" : "login"; msg = info = ""; draw(); };
    const mg = $("#acc-magic"); if (mg) mg.onclick = () => { email = $("#acc-email").value.trim(); step = "email"; msg = info = ""; draw(); };
    const fg = $("#acc-forgot"); if (fg) fg.onclick = async () => {
      email = $("#acc-email").value.trim();
      if (!email) { msg = "Tape d'abord ton adresse e-mail."; draw(); return; }
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: redirect });
      msg = error ? friendly(error.message) : ""; info = error ? "" : `E-mail envoyé à <b>${esc(email)}</b> : clique sur le lien pour choisir un nouveau mot de passe.`; draw();
    };
    const sp = $("#acc-setpw");
    if (sp) sp.onsubmit = async e => {
      e.preventDefault(); const password = $("#acc-pw3").value; busy = true; msg = ""; draw();
      const { error } = await supabase.auth.updateUser({ password });
      busy = false; if (error) msg = friendly(error.message); else toast("Mot de passe enregistré : utilise-le pour te connecter sur tes autres appareils"); draw();
    };
    const nf = $("#acc-new");
    if (nf) { $("#acc-pw2").focus(); nf.onsubmit = async e => {
      e.preventDefault(); const password = $("#acc-pw2").value; busy = true; msg = ""; draw();
      const { error } = await supabase.auth.updateUser({ password });
      busy = false; if (error) { msg = friendly(error.message); draw(); return; }
      recovering = false; step = "login"; toast("Mot de passe enregistré"); draw();
    }; }
    const c = $("#acc-code");
    if (c) { $("#acc-otp").focus(); c.onsubmit = async e => {
      e.preventDefault(); const token = $("#acc-otp").value.trim(); busy = true; msg = ""; draw();
      const { error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
      busy = false; if (error) { msg = "Code incorrect ou expiré."; draw(); }
    }; }
    const back = $("#acc-back"); if (back) back.onclick = () => { step = "login"; msg = ""; draw(); };
    const pr = $("#acc-prof"); if (pr) pr.onclick = close;
    const sy = $("#acc-sync"); if (sy) sy.onclick = () => startSync(session.user.id);
    const out = $("#acc-out"); if (out) out.onclick = async () => { await supabase.auth.signOut(); toast("Déconnecté. Ta collection reste sur cet appareil."); close(); };
  };
  openModal = draw;
  draw();
}

if (cloudEnabled && btn) {
  btn.hidden = false;
  btn.onclick = () => { location.hash = "#/profil"; };
  // load Supabase after the first screen is drawn, so the app opens just as fast as before
  Promise.all([import("./client.js"), import("./sync.js")]).then(([c, sy]) => {
  ({ supabase } = c);
  ({ startSync, stopSync, syncState, onSyncState, queuePush } = sy);
  setCloud({ supabase });
  onSyncState(paintButton);
  supabase.auth.onAuthStateChange((event, s) => {
    if (event === "PASSWORD_RECOVERY") { recovering = true; setTimeout(() => { if (!openModal) openAccount(); }, 0); }
    const was = session?.user.id;
    session = s;
    if (s?.user.id !== was) setCloud({ user: s?.user || null, profile: null, ready: true });
    else if (!cloud.ready) setCloud({ ready: true });
    paintButton();
    if (s && s.user.id !== was) {
      // outside the auth callback: Supabase calls made inside it can wait on each other
      setTimeout(() => loadMyProfile().catch(e => { console.warn("[cloud] profil", e); setCloud({ profile: { id: s.user.id, handle: null, error: profileError(e) } }); }), 0);
      startSync(s.user.id);
      if (event === "SIGNED_IN") { toast("Connecté"); if (recovering) openModal?.(); else closeModal?.(); }
    }
    if (!s && was) stopSync();
    // remove ?code=… left by the e-mail link
    if (location.search.includes("code=")) history.replaceState(null, "", location.pathname + location.hash);
  });
  addEventListener("collection:changed", queuePush);
  }).catch(e => { console.error("[cloud] chargement impossible", e); setCloud({ ready: true }); });
}
