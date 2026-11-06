/* Installable app: service worker (offline) + "Installer l'app" button and help window. */
import { $, ICON } from "./lib/core.js";

const standalone = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
const ua = navigator.userAgent;
const isIOS = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const isSafari = /Safari/.test(ua) && !/Chrome|CriOS|FxiOS|EdgiOS|Edg\//.test(ua);

let deferred = null;   // Chrome / Edge / Android: the browser's own install prompt, kept for our button
const btn = $("#btn-install");

function paint() { if (btn) btn.hidden = standalone(); }

addEventListener("beforeinstallprompt", e => { e.preventDefault(); deferred = e; paint(); });
addEventListener("appinstalled", () => { deferred = null; paint(); });

// the service worker only runs on the built site (npm run build / the live site), not in npm run dev
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  addEventListener("load", () => {
    navigator.serviceWorker.register(import.meta.env.BASE_URL + "sw.js", { scope: import.meta.env.BASE_URL }).catch(() => {});
  });
}

const STEPS = {
  ios: `<ol class="steps"><li>Ouvre ce site dans <b>Safari</b>.</li><li>Touche le bouton <b>Partager</b> (le carré avec une flèche vers le haut).</li><li>Choisis <b>Sur l'écran d'accueil</b>, puis <b>Ajouter</b>.</li></ol>`,
  iosOther: `<p class="note">Sur iPhone et iPad, l'installation se fait depuis <b>Safari</b> : copie l'adresse du site, ouvre-la dans Safari, puis :</p>`,
  android: `<ol class="steps"><li>Ouvre le menu du navigateur (les <b>⋮</b> en haut à droite).</li><li>Choisis <b>Installer l'application</b> ou <b>Ajouter à l'écran d'accueil</b>.</li></ol>`,
  desktop: `<ol class="steps"><li>Dans Chrome ou Edge, clique sur l'icône d'installation à droite de la barre d'adresse.</li><li>Ou ouvre le menu, puis <b>Installer PokéClasseur</b>.</li></ol><p class="note">Sur Mac avec Safari : menu <b>Fichier</b> → <b>Ajouter au Dock</b>.</p>`
};

export function openInstall() {
  if (deferred) {   // the browser can install directly
    deferred.prompt();
    deferred.userChoice.finally(() => { deferred = null; paint(); });
    return;
  }
  const root = $("#modal-root");
  const close = () => { root.innerHTML = ""; document.body.style.overflow = ""; document.removeEventListener("keydown", key); };
  const key = e => { if (e.key === "Escape") close(); };
  document.addEventListener("keydown", key); document.body.style.overflow = "hidden";
  const how = isIOS ? (isSafari ? STEPS.ios : STEPS.iosOther + STEPS.ios) : /Android/.test(ua) ? STEPS.android : STEPS.desktop;
  root.innerHTML = `<div class="modal" id="mdl"><div class="sheet formsheet acc" role="dialog" aria-modal="true" aria-label="Installer l'app"><button class="iconbtn close" id="m-close" aria-label="Fermer">${ICON.x}</button><div class="info">
    <h2>Installer l'app</h2>
    <p class="note">PokéClasseur s'ajoute à ton écran d'accueil comme une vraie app : plein écran, ouverture rapide, et ta collection reste consultable sans connexion.</p>
    ${how}
  </div></div></div>`;
  $("#m-close").onclick = close; $("#mdl").onclick = e => { if (e.target.id === "mdl") close(); };
}

if (btn) { btn.onclick = openInstall; paint(); }
