/* PokéClasseur — entry point.
   Styles first (order matters), then modules with side effects, then the router. */
import "./styles/base.css";
import "./styles/cards.css";
import "./styles/binder.css";
import "./styles/pages.css";
import "./styles/pokedex.css";
import "./styles/products-stats.css";
import "./styles/union.css";
import "./styles/mobile.css";     // phone layout, only under html.m

import "./state/prefs.js";        // applies the theme + theme button
import "./features/variants.js";  // pointer tracking for the card shine
import "./data/tcgdex.js";        // image / logo fallback handlers on window
import "./features/sync.js";      // backup / sync button (code or file)
import "./cloud/account.js";      // account + cloud sync (only when Supabase is configured)
import "./pwa.js";                // offline service worker + "Installer l'app"
import "./mobile.js";             // phone layout: tab bar, menu, swipes

import { $ } from "./lib/core.js";
import { LS } from "./lib/storage.js";
import { drawCards } from "./pages/set.js";
import { route } from "./router.js";
import { COL_KEY } from "./state/collection.js";
import { PREF } from "./state/prefs.js";
import { S } from "./state/shared.js";

addEventListener("hashchange", route);
addEventListener("collection:replaced", route);   // cloud sync merged a new collection in
// another tab changed the collection: reload it
addEventListener("storage", e => { if (e.key === COL_KEY) S.COL = LS.get(COL_KEY, S.COL); });
// the binder shows 1 or 2 pages depending on width
let rz;
addEventListener("resize", () => { clearTimeout(rz); rz = setTimeout(() => { if (PREF.view === "binder" && $("#cards")) drawCards(); }, 200); });

route();
