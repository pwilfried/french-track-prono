# Profils et inscription (v0.10)

Décisions du propriétaire du 8 novembre 2026 (atelier #278, inscription #328, clubs #337).

## Ce que le joueur renseigne et modifie

- **À l'inscription** (`/bienvenue`) : pseudo, dossard (tiré au hasard, modifiable ; il remplace l'avatar emoji depuis #537), 15 ans
  ou plus (comme avant), puis
  **sexe**, **disciplines pratiquées** et **club**. Sexe, disciplines et club sont facultatifs :
  un joueur peut jouer sans les donner, et les compléter plus tard.
- **Disciplines** : cases à cocher regroupées par famille (Sprint : 100 m, 200 m, 400 m ; Haies ;
  Demi-fond ; Fond ; Sauts ; Lancers ; Épreuves combinées ; Marche ; Route). Plusieurs choix,
  dans une ou plusieurs familles. Les familles et les disciplines sont celles de la table
  `disciplines`.
- **Dans son profil** (`/profil`), le joueur modifie lui-même : pseudo, dossard, sexe,
  disciplines, club, et son **e-mail de connexion** (un code est envoyé sur la nouvelle adresse,
  qui ne remplace l'ancienne qu'une fois le code saisi).

## Club

- Le joueur **cherche son club** en tapant quelques lettres (sans accents ni casse) ; la ville
  est affichée pour départager les homonymes.
- **Source** : l'API publique « Recherche d'entreprises » de l'État : associations « clubs de
  sports » (code NAF 93.12Z) encore actives dont le nom évoque l'athlétisme. Le test du
  8 novembre 2026 en a trouvé 2 838 dans 107 départements (la FFA compte un peu plus de 2 000
  clubs). Les sections d'autres sports (handball, pétanque, cyclotourisme, haltérophilie…) sont
  écartées, les noms remis en forme. Import par un workflow GitHub, à la main puis chaque mois.
- La base des clubs de la FFA (athle.fr) interdit la collecte automatique : on ne l'utilise pas.
  Un export officiel (FFA ou ligue) pourra être importé par-dessus plus tard.
- **Club introuvable** : le joueur l'écrit lui-même ; il est enregistré « à valider » et l'admin
  le valide ou le fusionne avec un club existant.

## Ce que voient les autres joueurs

Toucher un pseudo dans un classement ouvre une **fiche minimale** : pseudo, dossard, club et
rang. Jamais l'e-mail, ni le sexe, ni les disciplines.

## Mots interdits

Une seule liste (insultes, noms qui feraient officiels, liens) pour les noms de ligues
publiques, les pseudos (inscription et changement) et les clubs saisis à la main. Même règle
dans le code (`src/domain`) et en base.

## Ce que fait l'admin

- **Chercher** un joueur par pseudo (back-office « Joueurs »).
- **Bloquer** un compte : il ne pronostique plus, ne crée ni ne rejoint de ligue, et disparaît
  du classement général et des classements de ligue tant qu'il est bloqué (l'admin, lui, voit
  toujours ses lignes). Débloquer le rétablit.
- **Supprimer** un compte, comme si le joueur le faisait lui-même.
- L'admin ne renomme pas les pseudos. Chaque action est notée dans l'Historique.
- Un admin ne peut être ni bloqué ni supprimé depuis le back-office.

## Livraison

v0.10 : #344 (mots interdits), #339 (clubs), #340 (inscription), #341 (profil et e-mail),
#342 (fiche minimale), #343 (admin « Joueurs »).
