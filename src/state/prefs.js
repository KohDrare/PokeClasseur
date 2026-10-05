import { $ } from "../lib/core.js";
import { LS } from "../lib/storage.js";

/* ---------- prefs ---------- */
export const PREF = Object.assign({ view: "grid", own: "all", versions: false, theme: "" }, LS.get("pc-prefs", {}));
export const savePref = () => LS.set("pc-prefs", PREF);
if (!PREF.theme) PREF.theme = "light"; /* clair par défaut, le bouton lune passe en sombre */
export function applyTheme() { document.documentElement.dataset.theme = PREF.theme; }
applyTheme();
$("#btn-theme").onclick = () => {
  PREF.theme = PREF.theme === "dark" ? "light" : "dark"; savePref(); applyTheme();
};
