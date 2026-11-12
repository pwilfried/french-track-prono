# Audit UX — v0.12 (fin)

Première passe de l'audit demandé par [#470](https://github.com/pwilfried/french-track-prono/issues/470).
Faite depuis le navigateur intégré, logé en tant que `Démo Gazelle` sur l'état de démo monté par
`npm run db:demo-full` (#468), mobile 390 px, mode sombre, 2026-11-11 après-midi. Chaque friction
notée est un **candidat d'issue** : « F1 … F12 » ci-dessous. Un oui du propriétaire la promeut en
issue dédiée.

Les parcours non encore audités sont listés en bas.

## Ce qui marche bien, à garder

- **Compte à rebours sur la home** (« Prochaine finale dans 39 min ») : accroche immédiatement.
- **Compte à rebours de verrouillage** sur l'épreuve (barre rouge, timer) : urgence claire.
- **Tuiles « Classement général » / « Ma ligue »** sur la home : résument l'état en un coup d'œil.
- **Fiche d'épreuve terminée** : podium visuel (2-1-3 avec couleurs et marques), bandeau « +N pts »,
  ligne « TON PRONO VS OFFICIEL » qui dit « podium » ou « exact » par place.
- **Fiche ligue** : les onglets Classement / Membres / Inviter sont là où on les attend, le code
  d'invitation est visible dès le header.
- **Fiche Manager** : la statut-pill (« Prêt : la saison peut être lancée »), les règles
  résumées (4 lignes), la liste des participants, le gros bouton « Catalogue du mercato ».
- **Footer-sticky « Ta place » sur /classement** : très utile quand on est loin dans le tableau.

## Frictions repérées

### F1 · « Manager » caché dans Ligues _(déjà ouvert : [#471](https://github.com/pwilfried/french-track-prono/issues/471))_

Pour atteindre le Manager il faut passer par `/ligues` et cliquer un bouton parmi quatre. La nav
du bas (Accueil / Épreuves / Classement / **Ligues** / Profil) ne mentionne pas le Manager, qui
est un mode de jeu à part. _Reco :_ soit une tuile sur la home, soit un sixième onglet, soit une
sous-nav dans Ligues avec « Prono / Manager » bien visibles.

### F2 · La page d'épreuves ne distingue pas « terminée » de « à venir »

Sur `/epreuves`, toutes les cartes affichent exactement la même chose (heure + discipline +
« ✓ Posé »), qu'il s'agisse d'une finale d'hier ou de demain. L'utilisateur ne sait pas où regarder
en premier. _Reco :_ un badge « Terminé » coloré distinct, le résultat ou les points gagnés visibles
directement sur la carte, et un séparateur « ÉPREUVES À VENIR » / « DÉJÀ COURUES ».

### F3 · Icône 🔥 non expliquée dans le classement

Les cartes du classement affichent « Démo Javelot 🔥12 ». Impossible de deviner ce que signifient
le flame et le 12 (nombre de pronos ? série ? pourcentage ?). _Reco :_ libellé au survol, texte en
dessous, ou légende en haut du classement.

### F4 · « 100 % réussite » dans Mes Stats du profil

La tuile « 100 % RÉUSSITE » (profil) sort alors que 0 podium parfait et 0 vainqueur sont trouvés
juste à côté. On ne sait pas de quoi 100 % est le pourcentage. _Reco :_ libellé plus précis
(« % pronos envoyés à temps »), ou retirer la tuile tant que la donnée n'est pas claire.

### F5 · Message du bandeau points contredit le résultat

Sur `/epreuves/x-4x100m` (relais mixte), après un prono à 10 points, le bandeau vert affiche :

> ** +10 pts** — Aucun athlète sur le podium

Mais les trois athlètes prédits SONT sur le podium (juste dans le mauvais ordre : 2 sur 3 en
« podium » et 1 en « exact »). _Reco :_ un message qui reflète vraiment le cas (« 3 athlètes sur
le podium, 1 à sa place »), et surtout cohérent avec la ligne « TON PRONO VS OFFICIEL » juste en
dessous.

### F6 · Classement de ligue vide alors que les points existent

Sur `/ligues/<id>` de « Démo Prono » (12 membres, couvre l'Ultimate Championship), tous les
membres apparaissent à 0 point « Pas encore de points ». Pourtant `/classement` les montre à
50-70-96 pts chacun, et `score_events` contient bien les lignes attachées à cette compétition.
Le classement de ligue ne lit visiblement pas la même source — suspect d'une requête côté client
qui filtre plus large que prévu. _Reco :_ bug à ouvrir seul ; probablement lié à [#469](https://github.com/pwilfried/french-track-prono/issues/469)
(liste d'athlètes unique) ou à sa cousine « source unique de score ». À vérifier avant de livrer v0.12.

### F7 · Tutoriel 1/3 présent même sur un podium déjà posé

L'épreuve `/epreuves/f-1500m` (1500 m F) affiche la carte « 1/3 Touche un athlète : il monte sur
la marche… » juste au-dessus du podium **déjà rempli**. Pour un joueur qui modifie un podium, la
carte n'apporte rien et pousse l'action utile hors de la fold. _Reco :_ cacher le tutoriel quand
`predictions.p1/p2/p3` sont déjà posés (ou le replier derrière le « ? » qui est déjà là).

### F8 · Bouton « ? » discret à côté du titre « MON PODIUM »

Sur la même page, le rond « ? » à droite de « MON PODIUM » ne dit pas ce qu'il fait. Est-ce l'aide
du podium ? Les règles de scoring ? _Reco :_ libellé visible (« Aide ») ou tooltip au hover.

### F9 · Card Manager sans accessible name

Sur `/manager`, la carte « Démo Manager » est un `<a href>` qui enveloppe toute la carte mais
n'a pas d'aria-label. L'arbre d'accessibilité la montre comme `link` sans nom. Un lecteur
d'écran ne sait pas ce qu'elle fait. _Reco :_ `aria-label={ligue.name}` sur le lien, ou lier le
titre via `aria-labelledby`.

### F10 · « LIGUES PUBLIQUES » dit « aucune » quand on en possède une

Sur `/ligues` et sur `/manager`, le bloc « Ligues publiques » renvoie « Pas encore de ligue
publique à rejoindre » alors que l'utilisateur possède justement une ligue publique (Démo Prono,
Démo Manager). _Reco :_ reformuler : « Tu possèdes déjà la seule ligue publique » ou « 0 autre
ligue publique à rejoindre ».

### F11 · Filtres du catalogue mercato trop verticaux

Sur `/manager/<id>/catalogue`, le bloc de filtres (recherche + sexe + famille + checkbox +
bouton Filtrer) prend un écran entier avant la première carte d'athlète. Sur un catalogue qu'on
parcourt, les filtres doivent être compacts. _Reco :_ regrouper sur une seule ligne, retirer le
bouton « Filtrer » si les changements s'appliquent instantanément, laisser la recherche prendre
toute la largeur en priorité.

### F12 · Spacing du formulaire welcome _(déjà fixé : [#466](https://github.com/pwilfried/french-track-prono/issues/466))_

Repéré par le propriétaire en local : labels collés aux champs. Correctif livré dans [#475](https://github.com/pwilfried/french-track-prono/pull/475).

## Parcours encore à auditer

Les parcours ci-dessous n'ont été que survolés — à reprendre dans une 2e passe :

- **Signup bout en bout** : magic link → `/bienvenue` → premier podium. Le spacing est corrigé mais
  la grosseur du picker d'épreuves (#467) et le flow « confirme mail → tape pseudo → choisis des
  pronos » méritent une passe à part.
- **Partage** : « Partager ma carte de saison » (bouton orange sur le profil) n'a pas été testé.
- **Admin complet** : seule la page d'atterrissage a été vue ; les sections Athlètes, Compétitions,
  Joueurs, Clubs, Règles, Manager sont à parcourir.
- **États vides** : visiter l'app comme un nouveau joueur (aucun prono, aucune ligue) pour voir si
  les tuiles et messages aident ou frustrent.
- **Erreurs** : forcer les erreurs serveur (coupure réseau, Supabase arrêté) et voir ce que
  l'app affiche.

## Prochaines étapes

Une fois la passe validée par le propriétaire :

1. Chaque F1–F11 confirmée devient une issue (label `bug` ou `feature`, zone selon la page).
2. Les plus simples (F3, F9, F10) peuvent partir en `agent:ready` tout de suite.
3. F2, F6, F7 touchent la lisibilité du jeu : à prioriser avant la v0.13 Mercato.
4. F1 (#471) est déjà ouverte. F12 (#466) est livrée. Bonne base pour la suite.
