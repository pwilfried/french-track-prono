# Ligues de saison avec enchères sur les athlètes (spike #62)

> **Remplacé** par le cahier des charges du propriétaire : voir `french-track-manager.md` (F19,
> versions v0.12 à v0.16). Les propositions ci-dessous ne sont plus d'actualité.

Étude du 9 novembre 2026 sur l'idée du propriétaire (6 novembre 2026). Les réponses ci-dessous
sont des propositions : chacune est à trancher par le propriétaire avant d'écrire la moindre
issue.

## L'idée

Une ligue couvre les grandes compétitions de la saison. Au départ, ses joueurs achètent des
athlètes aux enchères, comme au MPG, puis s'affrontent compétition après compétition.

## Réponses proposées

**Monnaie virtuelle seulement.** Un budget de départ identique pour tous (par exemple
500 « crédits »), sans achat, sans lien avec de l'argent réel, sans lot. C'est la condition
pour rester hors du droit des jeux d'argent (ANJ) et cohérent avec les non-objectifs.

**Les athlètes s'ajoutent aux pronos, ils ne les remplacent pas.** Chaque joueur a une écurie
(par exemple 8 athlètes). Un athlète de l'écurie rapporte des points selon sa place réelle
dans une finale (table `results`, déjà saisie par l'admin) : 8 points au 1er, 6 au 2e, 4 au
3e, 1 pour une place en finale. La ligue de saison a deux classements : les pronos (comme
aujourd'hui) et l'écurie, plus un total. Le cœur du jeu (composer un podium) ne change pas.

**Exclusif dans une ligue.** Comme au MPG : un athlète n'appartient qu'à un joueur de la
ligue. C'est ce qui rend l'enchère intéressante.

**Blessure ou forfait : 0 point**, pas de remplacement automatique. Un mercato entre deux
compétitions permet de revendre un athlète (à moitié prix) et d'en racheter un libre.

**Enchères sous pli, sur deux jours.** Chaque joueur dépose ses offres en secret ; à la clôture,
l'offre la plus haute gagne, à égalité la plus ancienne. Pas d'enchère en direct : elle exige
que tout le monde soit là au même moment, ce qui ne marche pas entre amis sur téléphone.

## Données nécessaires

- Le calendrier de la saison : les compétitions existent déjà, avec leur type.
- La liste des athlètes achetables : la table `athletes` et leurs records (`athlete_records`)
  suffisent pour une première version, sans liste de départ connue à l'avance.
- Les résultats des finales : déjà saisis pour calculer les pronos.

## Ce que ça coûterait

Une version à part entière, de 6 à 8 issues : tables (écuries, offres, mercato) et règles en
base, clôture des enchères (fonction planifiée), écran d'enchères, écran d'écurie, calcul des
points d'écurie à partir des résultats, classement de ligue à deux colonnes, mercato, e2e.

## Recommandation

Faisable sans changer le cœur du jeu. À planifier comme une version dédiée seulement si la
saison 2027 confirme une base de joueurs fidèles : c'est une fonctionnalité de rétention pour
les joueurs déjà là, elle n'en fera pas venir de nouveaux. D'ici là, rien à développer.
