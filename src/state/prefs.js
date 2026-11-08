import { $ } from "../lib/core.js";
import { LS } from "../lib/storage.js";

/* ---------- prefs ---------- */
export const PREF = Object.assign({ view: "grid", own: "all", versions: false, theme: "" }, LS.get("pc-prefs", {}));
export const savePref = () => LS.set("pc-prefs", PREF);
if (!PREF.theme) PREF.theme = "light"; /* clair par défaut, le bouton lune passe en sombre */
export function applyTheme() { document.documentElement.dataset.theme = PREF.theme; applyGray(); }
/* missing cards in grey (default) or in colour */
export function applyGray() { document.documentElement.classList.toggle("nogray", PREF.gray === false); }
applyTheme();
$("#btn-theme").onclick = () => {
  PREF.theme = PREF.theme === "dark" ? "light" : "dark"; savePref(); applyTheme();
};
