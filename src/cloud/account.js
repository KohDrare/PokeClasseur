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
let openModal = null;   // redraw function of the account window while it is open
const btn = $("#btn-account");

const friendly = m => /fetch|network/i.test(m || "") ? "Impossible de joindre le serveur. Vérifie ta connexion et réessaie." : /rate|seconds/i.test(m || "") ? "Trop de demandes : attends une minute avant de réessayer." : m;
const STATUS_TEXT = { off: "Non connecté", syncing: "Synchronisation…", ok: "Collection synchronisée", error: "Erreur de synchronisation", offline: "Hors ligne : la synchro reprendra au retour du réseau" };

const BTN_ICON = btn ? btn.innerHTML : "";
function paintButton() {
  if (!btn) return;
  const p = cloud.profile;
  btn.dataset.state = session ? syncState.status : "off";
  btn.title = session ? `${p?.handle ? "@" + p.handle : session.user.email} · ${STATUS_TEXT[syncState.status]}` : "Se connecter";
  const face = session && p?.handle ? `<img class="acc-av" src="${sprite(p.avatar || 25)}" alt="">` : BTN_ICON;
  if (btn.innerHTML !== face) btn.innerHTML = face;
}
addEventListener("cloud:changed", () => { paintButton(); openModal?.(); });

export function openAccount() {
  const root = $("#modal-root");
  let step = "email", email = "", busy = false, msg = "";
  const close = () => { root.innerHTML = ""; document.body.style.overflow = ""; document.removeEventListener("keydown", key); off(); openModal = null; };
  const key = e => { if (e.key === "Escape") close(); };
  const off = onSyncState(() => session && draw());
  document.addEventListener("keydown", key); document.body.style.overflow = "hidden";

  const draw = () => {
    const n = Object.keys(S.COL.cards).length;
    const body = session ? `
      <h2>Mon compte</h2>
      <p class="note">${esc(session.user.email)}</p>
      ${cloud.profile?.handle
        ? `<a class="acc-prof" href="#/union/profile" id="acc-prof"><img src="${sprite(cloud.profile.avatar || 25)}" alt=""><span><b>${esc(cloud.profile.name || cloud.profile.handle)}</b><small>@${esc(cloud.profile.handle)} · voir mon profil</small></span></a>`
        : `<a class="acc-prof new" href="#/union/profile" id="acc-prof"><span><b>Crée ton profil de dresseur</b><small>Choisis ton pseudo et ton avatar pour la Union Room</small></span></a>`}
      <div class="acc-status st-${syncState.status}"><i></i><div><b>${STATUS_TEXT[syncState.status]}</b><small>${n} carte${n > 1 ? "s" : ""} dans ta collection${syncState.at ? ` · dernière synchro ${new Date(syncState.at).toLocaleTimeString("fr-BE", { hour: "2-digit", minute: "2-digit" })}` : ""}</small>${syncState.status === "error" ? `<small class="err">${esc(syncState.error)}</small>` : ""}</div></div>
      <p class="note">Ta collection et tes achats sont enregistrés dans ton compte : connecte-toi sur un autre appareil pour les retrouver.</p>
      <div class="acts"><button class="pill" id="acc-sync">Synchroniser maintenant</button><button class="pill ghost" id="acc-out">Se déconnecter</button></div>`
    : step === "email" ? `
      <h2>Se connecter</h2>
      <p class="note">Pas de mot de passe : on t'envoie un lien de connexion par e-mail. Ta collection actuelle sera ajoutée à ton compte.</p>
      <form id="acc-form" class="acc-form"><label for="acc-email">Adresse e-mail</label><input id="acc-email" type="email" autocomplete="email" required value="${esc(email)}" placeholder="toi@exemple.be"><button class="pill" ${busy ? "disabled" : ""}>${busy ? "Envoi…" : "Recevoir le lien"}</button></form>
      ${msg ? `<p class="note err">${esc(msg)}</p>` : ""}`
    : `
      <h2>Vérifie tes e-mails</h2>
      <p class="note">Un e-mail a été envoyé à <b>${esc(email)}</b>. Clique sur le lien qu'il contient pour te connecter. Si l'e-mail contient aussi un code à 6 chiffres, tu peux le taper ici.</p>
      <form id="acc-code" class="acc-form"><label for="acc-otp">Code</label><input id="acc-otp" inputmode="numeric" autocomplete="one-time-code" maxlength="8" required placeholder="123456"><button class="pill" ${busy ? "disabled" : ""}>${busy ? "Vérification…" : "Valider"}</button></form>
      ${msg ? `<p class="note err">${esc(msg)}</p>` : ""}
      <button class="linkbtn" id="acc-back">Changer d'adresse</button>`;
    root.innerHTML = `<div class="modal" id="mdl"><div class="sheet formsheet acc" role="dialog" aria-modal="true" aria-label="Compte"><button class="iconbtn close" id="m-close" aria-label="Fermer">${ICON.x}</button><div class="info">${body}</div></div></div>`;
    $("#m-close").onclick = close; $("#mdl").onclick = e => { if (e.target.id === "mdl") close(); };
    const f = $("#acc-form");
    if (f) { $("#acc-email").focus(); f.onsubmit = async e => {
      e.preventDefault(); email = $("#acc-email").value.trim(); busy = true; msg = ""; draw();
      const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: location.origin + location.pathname } });
      busy = false; if (error) msg = friendly(error.message); else step = "code"; draw();
    }; }
    const c = $("#acc-code");
    if (c) { $("#acc-otp").focus(); c.onsubmit = async e => {
      e.preventDefault(); busy = true; msg = ""; draw();
      const { error } = await supabase.auth.verifyOtp({ email, token: $("#acc-otp").value.trim(), type: "email" });
      busy = false; if (error) { msg = "Code incorrect ou expiré."; draw(); }
    }; }
    const back = $("#acc-back"); if (back) back.onclick = () => { step = "email"; msg = ""; draw(); };
    const pr = $("#acc-prof"); if (pr) pr.onclick = close;
    const sy = $("#acc-sync"); if (sy) sy.onclick = () => startSync(session.user.id);
    const out = $("#acc-out"); if (out) out.onclick = async () => { await supabase.auth.signOut(); toast("Déconnecté. Ta collection reste sur cet appareil."); close(); };
  };
  openModal = draw;
  draw();
}

if (cloudEnabled && btn) {
  btn.hidden = false;
  btn.onclick = () => supabase ? openAccount() : toast("Connexion au serveur…");
  // load Supabase after the first screen is drawn, so the app opens just as fast as before
  Promise.all([import("./client.js"), import("./sync.js")]).then(([c, sy]) => {
  ({ supabase } = c);
  ({ startSync, stopSync, syncState, onSyncState, queuePush } = sy);
  setCloud({ supabase });
  onSyncState(paintButton);
  supabase.auth.onAuthStateChange((event, s) => {
    const was = session?.user.id;
    session = s;
    if (s?.user.id !== was) setCloud({ user: s?.user || null, profile: null, ready: true });
    else if (!cloud.ready) setCloud({ ready: true });
    paintButton();
    if (s && s.user.id !== was) {
      // outside the auth callback: Supabase calls made inside it can wait on each other
      setTimeout(() => loadMyProfile().catch(e => { console.warn("[cloud] profil", e); setCloud({ profile: { id: s.user.id, handle: null, error: profileError(e) } }); }), 0);
      startSync(s.user.id);
      if (event === "SIGNED_IN") { toast("Connecté"); openModal?.(); }
    }
    if (!s && was) stopSync();
    // remove ?code=… left by the e-mail link
    if (location.search.includes("code=")) history.replaceState(null, "", location.pathname + location.hash);
  });
  addEventListener("collection:changed", queuePush);
  }).catch(e => { console.error("[cloud] chargement impossible", e); setCloud({ ready: true }); });
}
