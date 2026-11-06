# PokéClasseur

Ta collection de cartes Pokémon : séries et extensions (style Pokécardex), classeur, Pokédex, stats par extension, achats, et l'**Union Room** (fil, marché, échanges, messages).

## Démarrer

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # tests unitaires (Vitest)
npm run lint       # ESLint
npm run build      # build de production dans dist/
npm run preview    # sert dist/ en local
```

## Comptes et synchro cloud (Supabase)

Optionnel : sans configuration, l'app reste 100 % locale. Pour activer les comptes, suis [docs/SUPABASE.md](docs/SUPABASE.md) (tables SQL dans `supabase/migrations/`, clés dans `.env.local`).

## App installable et hors ligne

`public/sw.js` (service worker) et `public/manifest.webmanifest` rendent le site installable sur téléphone et ordinateur. Le bouton « Installer l'app » est en bas de page.

- Le service worker ne tourne que sur le site construit, pas avec `npm run dev`. Pour le tester en local : `npm run build` puis `npm run preview`, et ouvre http://localhost:4173/.
- Ce qui est gardé hors ligne : l'app, les images de cartes et logos déjà vus, les réponses de TCGdex. Supabase n'est jamais mis en cache.
- Pour forcer tout le monde à repartir de caches neufs, change `const V = "v1"` dans `public/sw.js`.

## Déploiement

Chaque push sur `main` lance `.github/workflows/deploy.yml` : tests → build → publication sur GitHub Pages.
Une seule fois : dans le dépôt GitHub, **Settings → Pages → Source : GitHub Actions**.

## Organisation du code

```
index.html                 squelette de la page (barre du haut, zone #app, #modal-root)
public/                    fichiers copiés tels quels (icône, manifest PWA)
src/
  main.js                  point d'entrée : styles, modules à effets de bord, routeur
  router.js                routes en #hash : /, /set/:id, /stats/:id, /collection, /pokedex/:region, /union/...
  styles/                  CSS découpé par zone (base, cartes + effets, classeur, pages, pokédex, produits/stats, union)
  lib/
    core.js                $, esc, icônes, URL de l'API
    storage.js             localStorage (LS) et cache IndexedDB (idb) avec repli mémoire
    ui.js                  toast, formats de date et de numéro, balise image de carte, navigation active
  state/
    shared.js              état partagé et modifiable : S.COL (collection), S.CUR (extension ouverte), S.SERIES
    collection.js          lecture / écriture de la collection (qtyOf, setQty, ownedAny…)
    prefs.js               préférences (vue, filtres, thème)
  data/
    tcgdex.js              accès à l'API TCGdex (séries, extensions, cartes) + logos
    pokecardex-map.js      correspondance extension TCGdex → code Pokécardex (logos, badges)
    dex-names.js           les 1025 noms français du Pokédex
    union-demo-cards.js    cartes des profils d'exemple de l'Union Room
  features/
    rarity.js              symboles de rareté (SVG)
    variants.js            versions (normale, reverse, holo), raretés spéciales, effets brillants, prix
    products.js            achats de produits scellés
    sync.js                sauvegarde / synchronisation par code ou fichier
  components/
    card-modal.js          fiche d'une carte
  pages/
    home.js  set.js  set-stats.js  collection.js  pokedex.js
  cloud/
    config.js              lit les clés Supabase (.env.local) ; tout le reste n'est chargé que si elles existent
    client.js              client Supabase (connexion par lien e-mail ou code)
    mapping.js             conversions collection ⇄ lignes de la base, fusion, différences (testées)
    sync.js                synchro : fusion à la connexion, envoi des changements ensuite
    account.js             bouton « Mon compte » et fenêtre de connexion
  union/
    store.js               données de l'Union Room (locales pour l'instant) + utilitaires
    shell.js picker.js feed.js market.js trades.js messages.js profile.js
supabase/migrations/       schéma SQL (tables + règles de sécurité)
docs/                      guides (Supabase…)
tests/                     tests Vitest
```

### Règles

- Une valeur modifiée par plusieurs modules passe par `S` (`state/shared.js`) : un import ES ne peut pas être réassigné.
- Pas de dépendance d'exécution : tout est en JavaScript natif + Vite.
- TypeScript est prêt (`tsconfig.json`, `npm run check`) : on convertit les fichiers un par un en `.ts`.

## Données

- Cartes, images et prix : [TCGdex](https://tcgdex.dev) (base sous licence MIT).
- Logos et badges d'extensions : Pokécardex (à héberger nous-mêmes avant un lancement public).
- Images des Pokémon : PokeAPI.

PokéClasseur n'est pas une application officielle Pokémon et n'est ni affiliée ni approuvée par Nintendo, Creatures, GAME FREAK ou The Pokémon Company.
