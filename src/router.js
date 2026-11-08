import { $ } from "./lib/core.js";
import { renderCollection } from "./pages/collection.js";
import { renderHome } from "./pages/home.js";
import { openMon, renderPokedex } from "./pages/pokedex.js";
import { renderScan, stopScanner } from "./pages/scan.js";
import { renderSetStats } from "./pages/set-stats.js";
import { renderSet } from "./pages/set.js";
import { renderUnion } from "./union/shell.js";   // Union Room: kept, not in the menus for now (#/union still opens it)
import { renderProfile } from "./pages/profile.js";

/* ================= ROUTER ================= */
export function route() {
  $("#modal-root").innerHTML = ""; document.body.style.overflow = "";
  stopScanner();   // turn the camera off when leaving the scanner
  const h = decodeURIComponent(location.hash.slice(1) || "/");
  const m = h.match(/^\/set\/(.+)$/);
  const dx = h.match(/^\/pokedex(?:\/([a-z]+))?(?:\/(\d+))?/);
  if (m) renderSet(m[1]);
  else if (dx) Promise.resolve(renderPokedex(dx[1])).then(() => { if (dx[2]) openMon(+dx[2]); });   // #/pokedex/kanto/25 opens Pikachu
  else if (h.startsWith("/stats/")) renderSetStats(h.slice(7));
  else if (h === "/union" || h.startsWith("/union/")) renderUnion(h.slice(7));
  else if (h.startsWith("/profil")) renderProfile();
  else if (h.startsWith("/collection")) renderCollection();
  else if (h.startsWith("/scan")) renderScan();
  else renderHome();
  scrollTo(0, 0);
}
