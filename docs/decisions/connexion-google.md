# Connexion avec Google (spike #74)

Étude du 9 novembre 2026. Recommandation à valider par le propriétaire, de préférence après les
retours des premiers testeurs sur la connexion par code.

## Aujourd'hui

On se connecte avec son e-mail : un code à 6 chiffres et un lien arrivent par Resend
(`/connexion`, captcha à la demande d'un code, arrivée par `/auth/callback`). Pas de mot de
passe : il faudrait un parcours de réinitialisation (encore un e-mail) et il apporte les
risques de réutilisation.

## Ce que changerait Google

- **Un geste au lieu de quatre** sur un nouvel appareil : pas de boîte mail à ouvrir, pas de
  code à recopier. C'est le moment où l'on perd des joueurs (lien ouvert dans le mauvais
  navigateur, e-mail en spam).
- **La connexion par code reste** : tout le monde n'a pas de compte Google, et c'est le seul
  moyen pour l'admin.
- **Même compte** : Supabase rattache l'identité Google au compte existant quand l'e-mail est le
  même et vérifié. Un joueur inscrit par code retrouve son profil.

## Ce qu'il faut faire

1. Google Cloud (propriétaire) : un client OAuth « Application Web », écran de consentement
   au nom de French Track Prono, domaine `frenchtrackprono.com` vérifié, URL de retour
   `https://<projet>.supabase.co/auth/v1/callback`. Portées `openid` et `email` seulement.
2. Supabase (tableau de bord et `supabase/config.toml` pour le local) : activer le
   fournisseur Google avec l'identifiant et le secret du client, ajouter l'URL du site aux
   URL de retour autorisées.
3. Code : un bouton « Continuer avec Google » sur `/connexion` (`signInWithOAuth`,
   PKCE) et l'échange du `code` dans `/auth/callback`, qui ne connaît aujourd'hui que le
   `token_hash` de l'e-mail. Le reste ne bouge pas : sans profil, le proxy envoie sur
   `/bienvenue`.
4. Tests : e2e du bouton avec un faux fournisseur en local (le vrai Google ne se teste pas en
   CI), test de l'échange du code.

Environ une issue et une PR.

## Profil et âge

- La case « 15 ans ou plus » reste obligatoire à `/bienvenue` : Google ne nous donne pas
  l'âge, et on ne le demande pas.
- Pseudo et avatar restent à choisir : on n'affiche jamais le nom ni la photo Google.

## Données personnelles

- Google apprend que le joueur se connecte à French Track Prono ; il faut l'écrire dans la page
  de confidentialité (Google devient un fournisseur de connexion, au choix du joueur).
- Supabase garde dans `auth.users` ce que Google renvoie (nom, photo) dans les métadonnées de
  l'identité. Avec les seules portées `openid` et `email`, il ne reçoit que l'e-mail et
  l'identifiant Google.
- L'export de données et la suppression de compte n'ont rien à changer : l'identité Google
  est supprimée avec le compte.
- Le captcha ne s'applique pas à ce parcours ; la protection contre les robots est celle de
  Google.

## Apple

« Se connecter avec Apple » n'est obligatoire que pour une appli de l'App Store qui propose
une connexion tierce. L'appli est une PWA : pas d'obligation. À ajouter seulement si des
joueurs sur iPhone le demandent (compte développeur Apple payant).

## Recommandation

Oui, en complément du code, dès que le propriétaire a créé le client OAuth Google. À faire
avant une grande compétition plutôt qu'en pleine compétition.
