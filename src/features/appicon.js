/* "Icône de l'app": the logo in the top bar, the browser tab and the home screen (Lumineux, Nuit, or following the theme).
   Already on a home screen: the phone keeps the icon it was added with (remove it and add it again to change it). */
import { LS } from "../lib/storage.js";

const KEY = "pc-icon", BASE = import.meta.env.BASE_URL;
export const APP_ICONS = [
  { k: "clair", l: "Lumineux" },
  { k: "nuit", l: "Nuit" },
  { k: "auto", l: "Selon le thème" }
];
export const iconChoice = () => LS.get(KEY, "clair");
const dark = () => { const t = document.documentElement.dataset.theme; return t === "dark" || ((!t || t === "auto") && matchMedia("(prefers-color-scheme: dark)").matches); };
const resolved = () => { const c = iconChoice(); return c === "auto" ? (dark() ? "nuit" : "clair") : c === "nuit" ? "nuit" : "clair"; };
export const iconSrc = (k, n = 180) => `${BASE}icons/${k}-${n}.png`;

export function applyAppIcon() {
  const k = resolved();
  const set = (sel, href) => { const l = document.querySelector(sel); if (l && l.getAttribute("href") !== href) l.setAttribute("href", href); };
  set('link[rel="apple-touch-icon"]', iconSrc(k, 180));
  set('link[rel="icon"]', iconSrc(k, 192));
  set('link[rel="manifest"]', `${BASE}${k === "nuit" ? "manifest-nuit.webmanifest" : "manifest.webmanifest"}`);
  const b = document.querySelector(".brand-ic"); if (b && !b.src.endsWith(`${k}-64.png`)) b.src = iconSrc(k, 64);
}
export function setAppIcon(k) { LS.set(KEY, k); applyAppIcon(); }

applyAppIcon();
// "Selon le thème": follows the dark mode switch
new MutationObserver(() => { if (iconChoice() === "auto") applyAppIcon(); }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
