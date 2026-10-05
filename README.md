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
  union/
    store.js               données de l'Union Room (locales pour l'instant) + utilitaires
    shell.js picker.js feed.js market.js trades.js messages.js profile.js
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
