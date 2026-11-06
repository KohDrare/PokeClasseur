# Brancher Supabase (comptes + collection dans le cloud)

Sans configuration, l'app reste 100 % locale. Ces étapes activent le bouton **Mon compte**.

## 1. Créer le projet
1. Crée un compte sur [supabase.com](https://supabase.com) → **New project**.
2. Région : **Europe (Frankfurt ou Paris)**, pour le RGPD.
3. Garde le mot de passe de la base dans un gestionnaire de mots de passe.

## 2. Créer les tables
**SQL Editor → New query**, colle `supabase/migrations/0001_init.sql`, puis **Run**.
Ça crée `profiles`, `collection_items` et `purchases`, avec des règles qui empêchent chacun de lire ou modifier les données des autres.

## 3. Régler la connexion par e-mail
**Authentication → URL Configuration**
- *Site URL* : `https://kohdrare.github.io/PokeClasseur/`
- *Redirect URLs* : ajoute `http://localhost:5173/` et `https://kohdrare.github.io/PokeClasseur/`

**Authentication → Email Templates → Magic Link** : ajoute le code dans le message, pour pouvoir se connecter depuis l'app installée sur téléphone :
```html
<h2>Ton lien de connexion PokéClasseur</h2>
<p><a href="{{ .ConfirmationURL }}">Se connecter</a></p>
<p>Ou tape ce code dans l'app : <strong>{{ .Token }}</strong></p>
```

## 4. Donner les clés à l'app
**Project Settings → API** : copie *Project URL* et la clé *anon public*.

En local : copie `.env.example` en `.env.local`, colle les deux valeurs, puis relance `npm run dev`.

Pour le site en ligne : sur GitHub, **Settings → Secrets and variables → Actions → Variables**, crée `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY`.

> La clé *anon* peut être publique : ce sont les règles de sécurité (RLS) de la migration qui protègent les données. Ne mets **jamais** la clé *service_role* dans l'app.

## 5. Profils publics et abonnements
Dans **SQL Editor**, colle le contenu de `supabase/migrations/0002_profiles_social.sql` puis **Run**. Le fichier peut être relancé sans risque.

Il ajoute :
- la vitrine (12 cartes au plus) et le choix de montrer ou non le résumé de sa collection ;
- la lecture publique des profils, pour qu'un lien `#/union/u/@pseudo` s'ouvre même sans compte ;
- la table `follows` (suivre un dresseur), où chacun ne peut ajouter ou retirer que ses propres abonnements ;
- la fonction `profile_card`, qui renvoie un profil, ses compteurs d'abonnés et un résumé de collection (cartes, extensions, Pokémon). Le détail des cartes reste privé.

Vérification : `select count(*) from public.follows;` doit répondre `0` sans erreur.

## Ce qui se passe à la connexion
1. L'app télécharge la collection du compte.
2. Elle la fusionne avec celle de l'appareil : pour chaque carte et version, la plus grande quantité gagne, et les achats sont réunis.
3. Elle envoie la différence au serveur.
4. Ensuite, chaque modification part toute seule après environ une seconde. Hors ligne, elle part au retour du réseau.
5. À la déconnexion, la collection reste sur l'appareil.
