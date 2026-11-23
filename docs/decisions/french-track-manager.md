# French Track Manager (F19)

« Recrute tes athlètes. Construis ton équipe. Domine la saison. »

Règles du cahier des charges fonctionnel du propriétaire, version 1.1 (phases 1 à 5 validées), mises
dans le dépôt le 9 novembre 2026. Elles remplacent les propositions du spike #62
(`ligues-saison-encheres.md`). Plan des versions : #415 ; questions : #416, #440, #441.

## Le jeu

Un mode de gestion d'équipe d'athlétisme dans French Track Prono. Chaque participant recrute son
équipe aux enchères secrètes, aligne une sélection avant chaque compétition, marque des points
avec les performances réelles de ses athlètes (barème hongrois), des bonus sportifs et ses
pronostics classiques, et affronte les autres dans un championnat aller-retour.

Le budget est en crédits virtuels, sans lien avec de l'argent réel : pas d'achat, pas de lot.

## 1. Ligue et règles (v0.12)

- Un joueur crée une ligue, en devient l'administrateur, choisit son nom et sa visibilité :
  **publique** (inscription libre dans la limite des places) ou **privée** (sur invitation du
  créateur). Il voit la liste des participants.
- **Le nombre de joueurs vient des compétitions** (décision du propriétaire du 13 nov. 2026, #644,
  qui remplace le choix d'un nombre pair de 4 à 10 de #619) : le championnat est un aller-retour,
  avec N joueurs **2 × (N − 1) journées**, une journée = une compétition (4 → 6, 6 → 10, 8 → 14,
  10 → 18). À la création, le créateur choisit **au moins 6 compétitions** parmi les compétitions
  éligibles (back-office) qui ne sont pas terminées. N = le plus grand nombre pair de 4 à 10 tel que
  2 × (N − 1) ≤ nombre de compétitions, exactement (10 compétitions → 6 joueurs). Les compétitions
  en trop, à la fin, sont des **journées bonus** (points du Manager seulement, sans confrontation) :
  8 compétitions → 4 joueurs, 6 journées + 2 bonus ; au-delà de 18, 10 joueurs et le reste en
  bonus. L'écran affiche le calcul en direct (« 8 compétitions → 4 joueurs · 6 journées
  aller-retour + 2 bonus »). La ligue est complète à ce nombre. Le créateur peut ajouter ou retirer
  des compétitions tant que le mercato n'est pas ouvert ; le nombre suit, jamais sous les inscrits.
- **Fin du mercato et première compétition** (#644) : une compétition ne compte que si le mercato
  finit **au moins 1 h avant sa première épreuve**. Avant l'ouverture, la fin est prévue après
  **3 tours** (`PLANNED_ROUNDS`, les 3 tours du calendrier de la page de la ligue). En durée
  personnalisée, si la fin prévue tombe moins de 1 h avant la première compétition, la page prévient
  le créateur (« Ton mercato finira après le début de … Elle ne comptera pas : la saison commencera
  à … »). S'il ne reste plus assez de compétitions pour l'aller-retour, le mercato ne se lance pas
  (ni à la main, ni à sa date) tant que le créateur n'a pas ajouté une compétition ou raccourci le
  mercato. Le calendrier des journées se génèrera à la fin du mercato, avec les compétitions qui
  remplissent la condition (`seasonCompetitions`), quand le championnat sera construit.
- **Réglages du mercato (créateur seulement, #619)** : durée des tours « automatique » (celle des
  règles French Track, fixée dans le back-office) ou « personnalisée » (1er tour et tours suivants :
  12, 24, 48 ou 72 h) ; date et heure de début (heure de Paris). Le mercato s'ouvre à cette date
  **si et seulement si** la cible est atteinte et qu'il reste assez de compétitions (#644), sinon
  il attend (la tâche des tours l'ouvre dès que c'est le cas). Le créateur peut aussi le lancer tout de suite, seulement quand la
  cible est atteinte. Les inscriptions ferment au lancement. Écran : la page de la ligue.
- En base (#619, #644) : `manager_leagues.player_target` (pair, 4 à 10, déduit des compétitions
  par `private.manager_player_count`), `competition_ids` (les compétitions choisies, la première
  d'abord), `mercato_starts_at` et `round_mode` (`auto` ou `custom`).
  `list_manager_available_competitions` liste les compétitions éligibles non terminées, avec leur
  première épreuve (`private.manager_first_event`) ; `create_manager_league(nom, publique,
  compétitions)` et `set_manager_competitions` (créateur seul, avant le mercato) vérifient le
  choix et recalculent la cible. `set_manager_mercato` enregistre les réglages (créateur seul) et
  récrit `rules.rounds` : en `auto`, les tours des règles French Track ; en `custom`, le 1er tour
  puis les suivants (`longRounds = 1`). `launch_manager_mercato` ouvre le mercato tout de suite ;
  `private.open_manager_mercatos`, lancé chaque minute par le job pg_cron `manager-rounds`, ouvre ceux dont la date est
  passée ; tous deux exigent la cible atteinte et assez de compétitions après la fin prévue
  (`private.manager_season_fits`). Codes : FT015 mercato déjà ouvert, FT026 joueurs manquants,
  FT027 compétitions refusées (moins de 6, indisponibles, ou moins de joueurs que d'inscrits),
  FT028 pas assez de compétitions après la fin prévue du mercato. Les ligues créées avant gardent
  leurs compétitions et leur cible. Règles pures : `seasonFormat`, `seasonCompetitions`,
  `hasEnoughCompetitions`, `src/domain/manager-league.ts`.
- **Présentation du mode** (#618, #616, puis #802) : à sa première visite de `/manager`, le
  joueur voit trois écrans par-dessus la page, qu'il peut passer à tout moment : le principe
  (recrute, aligne, affronte tes amis), la saison (mercato puis journées) et l'action (créer ou
  rejoindre une ligue). Elle n'est montrée qu'une fois (mémorisée sur l'appareil), puis à la
  demande (« Comment ça marche ? »). Aucun chiffre dans ces écrans : budget, taille d'équipe,
  titulaires, compétitions, joueurs et barème sont dans « Règles de la ligue », sur la page de la
  ligue, lus dans ses règles figées.
- **Catalogue avant le mercato** (#620) : le catalogue s'ouvre dès l'inscription, avec SB, PB et
  prix ; un bandeau de nuit donne le temps avant l'ouverture (« Date d'ouverture à venir » sans
  date), les participants par leur dossard, le dernier arrivé (`newestArrival`) et rappelle que
  les offres commencent au lancement.
- L'**admin de French Track Prono** fixe les règles générales : budget initial, quotas de
  composition des équipes (ex. sprinteurs hommes et femmes, demi-fond, fond, lancers), règles de
  recrutement, notation, bonus sportifs, compétitions éligibles, calendrier, durée des enchères,
  clôture du mercato, règles d'alignement.
- Le créateur d'une ligue choisit ses compétitions parmi les compétitions éligibles non terminées
  (#644, voir plus haut).
- **Sélecteur de compétitions** (#663, création de la ligue et réglages avant le mercato) : un seul
  écran pour la saison, `SeasonCompetitionPicker`. En tête, des sélections rapides qui cochent
  d'un geste (« Toute la saison », « Saison en salle », un niveau, « Grands championnats »,
  chacune avec son nombre, absente sans compétition) ; puis la recherche par nom ou ville, les
  filtres Portée, Lieu et Niveau, « Voir seulement mes compétitions cochées » ; la liste est
  rangée par mois (heure de Paris, « 3 / 5 » cochées, « Tout cocher » sur ce qui est affiché) ; une
  barre fixe compte les compétitions cochées et rappelle le minimum. Les deux listes de la base
  (`list_manager_available_competitions`, `list_manager_league_competitions`) rendent aussi ville,
  portée, lieu et niveau. Règles pures : `src/domain/season-picker.ts`.
- Les règles sont **figées à la création** de la ligue : tous ses participants jouent avec les
  mêmes paramètres.
- Écrans : back-office › Manager pour les règles (#418) ; `/manager` pour les ligues, depuis
  « Mes ligues » (#419) ; inscription en un geste à une ligue publique, ou par code et lien
  `/manager/rejoindre?code=…` pour une privée, close à l'ouverture du mercato (#420). Les ligues Manager ont leurs propres tables, à part des ligues de pronos.
- Les valeurs posées par la migration de #418 (budget 100, équipe
  d'au moins 12 depuis #607, alignement de 8, bonus…) sont un point de départ à ajuster par le propriétaire.

## 2. Mercato (v0.13)

- **Catalogue** : les athlètes de la base, avec nom, sexe, discipline, PB, SB, prix de référence et
  disponibilité.
- **Budget** : le même pour tous, fixé par l'admin. Le prix de référence est l'enchère minimale.
- **Enchères secrètes** : plusieurs athlètes à la fois, offres modifiables jusqu'à la clôture du
  tour, dans la limite du budget disponible. Pendant le tour, on ne voit que ses propres offres :
  ni celles des autres, ni leur nombre, ni sa position, ni la meilleure offre (à la fin du tour,
  tout est révélé : voir « Révélation de fin de tour »). La dernière offre compte.
- **Réservation** : une offre réserve son montant ; la somme des offres actives ne dépasse jamais
  le budget disponible ; une modification recalcule la réservation.
- Écran des offres (#422) : dans le catalogue, panneau « Mon budget » (budget, réservé, disponible,
  mes offres) et, sur chaque carte, enchérir, modifier ou retirer. On enchérit tant que le mercato
  de la ligue est ouvert (`mercato_opened_at`) ; la clôture des tours vient avec l'attribution
  (#423). Le secret est tenu par la base : table `manager_bids`, lecture limitée à ses propres
  offres, écriture seulement par `place_manager_bid` et `withdraw_manager_bid`.
- **Attribution** à la clôture d'un tour : l'offre la plus haute gagne ; à égalité, celle
  enregistrée en premier à ce montant (horodatage précis, mis à jour à chaque modification). Le
  montant est déduit, les réservations perdantes libérées. Un athlète n'appartient qu'à une
  équipe de la ligue.
- **Révélation de fin de tour** (changement de règle du propriétaire, 12 nov. 2026, #604) :
  pendant un tour, tout reste secret ; à la fin de chaque tour, tous les joueurs de la ligue voient
  **toutes les offres du tour** : pour chaque athlète, qui a enchéri, combien, et qui l'a eu.
  Avant, un joueur ne voyait que ses propres athlètes. En base : à la clôture d'un tour
  (`private.award_manager_round`), chaque offre est recopiée dans `manager_round_bids` avec
  `won` avant d'être effacée ; la lecture est ouverte à tout membre de la ligue (les lignes
  n'existent qu'une fois le tour clos), les offres du tour ouvert restent dans `manager_bids`
  (lecture de ses propres offres seulement). `manager_members.revealed_round` retient le dernier
  tour dont le joueur a vu la révélation (`mark_manager_round_revealed`, ne recule jamais) ;
  `manager_bid_rounds` liste les tours clos avec des offres et dit s'ils sont vus. Écran : la
  première ouverture du catalogue après la fin d'un tour mène à `/manager/<id>/tour/<n>`
  (« L'heure de vérité », une seule fois par tour et par joueur, marquée à l'affichage) : les
  offres du joueur en cartes face cachée, retournées une à une ou toutes, puis le bilan (offres
  gagnées, athlètes, crédits restants) ; ensuite « Toutes les enchères du tour » (une carte par
  athlète, offres de la plus haute à la plus basse, la gagnante en doré). Un tour sans offre n'a
  pas de révélation. Le résumé de chaque tour reste consultable depuis le catalogue
  (« Résultats des tours », `?vue=toutes`). Règles pures : `src/domain/manager-reveal.ts`.
  Une fois le mercato clos (`mercato_closed_at`), la ligue mène à « Revoir le mercato »
  (`/manager/<id>/mercato?tour=<n>`, #1089) : un sélecteur des tours clos avec des offres, et
  pour le tour choisi (le premier par défaut) chaque athlète disputé avec toutes ses offres et le
  gagnant ; les athlètes sans offre n'y sont pas. Rien de plus n'est lisible pendant le mercato.
- **Tours** : en durée « automatique », celle des règles French Track (au départ 48 h pour les
  tours 1 et 2, 24 h ensuite) ; en durée « personnalisée », celle choisie par le créateur (#619).
- Clôture des tours (#423) : les tours s'enchaînent depuis `mercato_opened_at`, durées prises dans
  les règles de la ligue (`rounds`). Le job pg_cron `manager-rounds` lance
  `private.close_manager_rounds()` chaque minute (comme les notifications push, #1158) : pour
  chaque tour échu, l'offre la plus haute gagne, à égalité la plus ancienne à ce montant
  (`awardBids`, `src/domain/manager-round.ts`, même règle en SQL) ; toutes les offres de la ligue
  sont ensuite effacées (les gagnantes deviennent des `manager_awards`, les perdantes sont
  libérées). Rejouer ne ferme rien deux fois (`manager_rounds`, clé primaire sur
  `manager_awards`). Entre la fin d'un tour et le passage du job, les offres attendent (FT020).
  Le budget disponible est le budget moins les athlètes gagnés ; un athlète gagné n'est plus
  « Libre » dans le catalogue. Dans `manager_awards`, un joueur lit ses propres athlètes ; ceux
  des autres et leur prix se lisent depuis #604 dans la révélation de fin de tour ; le panneau « Mon budget » montre le dépensé, la fin du tour et « Mes
  athlètes ».
- **Tour fini avant l'heure** (recette du propriétaire du 22 nov. 2026, #1084) : pendant un tour,
  « J'ai fini ce tour » dans « Mon budget », après confirmation (`finish_manager_round`) ; le
  joueur n'enchérit plus et ne change plus ses offres jusqu'au tour suivant (FT044) et voit
  « Tour terminé, en attente des autres (x/n) » (`manager_round_progress`). Qui a fini quel tour :
  `manager_round_done`, écrit seulement par la fonction, pour l'appelant, pendant le tour ; lu par
  les participants. Quand tous les participants ont fini, le tour se clôt tout de suite, comme à
  sa fin (attribution, révélation, tour suivant) ; les tours suivants gardent leur durée à partir
  de cette clôture : l'avance gagnée s'ajoute à `manager_leagues.mercato_advance` et chaque fin de
  tour se calcule depuis `mercato_opened_at - mercato_advance`. Côté TypeScript, statut et
  calendrier lisent les clôtures réelles des tours clos (`closedRounds`, `currentRound`,
  `mercatoStatus`, `mercatoCalendar`). Après le 3e tour (`PLANNED_ROUNDS`) fini par tous, le
  mercato se clôt (`private.finish_manager_mercato`). Le rappel « fin du tour dans 2 h » ne va
  plus à un joueur qui a fini le tour. Un joueur qui n'a pas fini garde le tour jusqu'à l'heure
  prévue.
- **Clôture du mercato**, de trois façons : plus aucun participant n'a de budget (après
  résolution des offres en cours) ; le dernier participant qui a encore du budget décide d'y
  mettre fin ; date programmée par les règles.
- **Pas de taille maximum d'équipe** (décision du propriétaire, 12 nov. 2026, #607) : on recrute
  autant d'athlètes que le budget le permet, dans les quotas. L'admin fixe seulement une **taille
  minimum** (`minTeamSize`, figée par ligue comme les autres règles) ; elle doit couvrir
  l'alignement (`lineup.max` ≤ `minTeamSize`). Les ligues créées avant gardent leurs règles : la
  migration de #607 renomme leur `teamSize` en `minTeamSize`. Depuis #1030, titulaires et banc y
  tiennent (`lineup.max` + `lineup.bench` ≤ `minTeamSize`).
- Clôture du mercato (#424, #607), selon les `closeModes` des règles de la ligue. « Peut
  recruter » : le budget restant (budget moins les athlètes
  gagnés, les offres en cours ne comptent pas) paie l'athlète libre le moins cher du catalogue
  (`canRecruit`, `src/domain/manager-mercato.ts` ; même règle en SQL,
  `private.manager_recruiters`). Le job `manager-rounds` clôt, après les tours échus, le mercato
  d'une ligue dont la date `mercato_closes_at` est passée (`scheduled`) ou dont plus personne ne
  peut recruter (`budgets_spent`). Le dernier participant qui peut recruter voit « Clore le
  mercato » dans « Mon budget » (`close_manager_mercato`, `last_bidder`). Clôture collective :
  toutes les lignes des participants sont verrouillées et relues ; les offres en cours sont
  attribuées comme un dernier tour, puis la ligue garde `mercato_closed_at` et ne prend plus
  d'offre (FT016). Entre la date programmée et le passage du job, les offres attendent (FT020).
  La saisie de `mercato_closes_at` par l'admin de la ligue n'a pas encore d'écran.
- **Complément automatique** à la clôture : une équipe incomplète reçoit au hasard des athlètes
  encore libres, dans le respect des quotas et du budget restant, au prix de référence, jusqu'à
  atteindre la taille minimum (pas au-delà), à budget épuisé ou sans athlète éligible abordable. Une équipe qui respecte les
  quotas minimums est validée, sinon signalée « non conforme ». La clôture est collective : la
  situation de tous est vérifiée avant de finaliser.
- Complément (#425), dans `private.finish_manager_mercato`, après les offres en cours : un
  athlète libre du catalogue convient à une équipe si elle est sous le minimum (`minTeamSize`), si
  son prix de référence tient dans le budget restant et si sa famille Manager a un quota
  (`quotas`) dont le maximum de son sexe (`maxPerSex`) n'est pas atteint (une famille sans quota
  ne se recrute pas ; `private.manager_complement_candidates`). Les équipes
  reçoivent un athlète chacune à tour de rôle (ordre des identifiants), tiré au hasard parmi ceux
  qui leur conviennent, jusqu'à ce qu'aucune ne puisse plus en recevoir. Les athlètes donnés
  forment un dernier tour (`manager_rounds`), au prix de référence. Puis chaque équipe reçoit
  `manager_members.team_compliant` : vrai si elle atteint le minimum de chaque quota (`min` en
  tout et `minPerSex` de chaque sexe, `unmetQuotas`), faux
  (« non conforme ») sinon ; nul avant la clôture. Le tirage utilise `random()` : `setseed()` le
  rend reproductible (tests pgTAP). L'affichage de « non conforme » n'a pas encore d'écran.

## 3. Équipe et alignement (v0.14)

- Après le mercato, l'équipe est **fixe pour la saison** : en version 1, ni achat, ni vente, ni
  échange, ni remplacement.
- L'équipe n'a pas de taille maximum (#607). « Mon équipe » affiche « N athlètes » ; sous la
  taille minimum, le message concret de #426 dit ce qui manquait (« Ton équipe compte 2 athlètes
  au lieu de 3 : … Tu joues quand même. »). L'alignement garde son nombre de titulaires
  (`lineup.max`), au plus la taille minimum.
- **Avant chaque compétition éligible**, le participant aligne une sélection de son équipe,
  modifiable d'une compétition à l'autre, selon les règles de l'admin : minimum par famille de
  disciplines (sprint, demi-fond, fond, sauts, lancers…), maximum total, compatibilité athlète /
  discipline.
- La sélection est validée avant le début de la compétition (athlètes de son équipe, chacun une
  fois, quotas et maximum respectés), puis **verrouillée** au début. Sans sélection validée :
  **0 point** pour la compétition.
- Pas de mercato secondaire payant : le budget reste en crédits virtuels (#416).
- Alignement (#427), écran `/manager/<id>/alignement` puis une page par compétition éligible de
  la ligue. Le stade compte `lineup.perFamily` places pour chacune des 4 familles Manager, sans
  place « Libre » (#1030 ; avant : des places par famille de `lineup.minPerFamily`, le reste
  « Libre »). Un alignement valide : des athlètes de son équipe, chacun
  une fois, **engagés** dans la compétition (`competition_athletes`, back-office ou liste de
  départ), et toutes les places que l'équipe peut remplir sont remplies ; une place que personne
  ne peut remplir (équipe incomplète, athlètes absents) reste vide sans bloquer
  (`lineupProblem`, `src/domain/manager-lineup.ts` ; même règle en SQL dans
  `save_manager_lineup`). Le **verrou** est le premier verrou des pronos de la compétition (à
  défaut d'épreuve, minuit heure de Paris le premier jour) ; un déclencheur refuse toute écriture
  dans `manager_lineups` après (FT023). Une ligne de `manager_lineups` est un alignement validé :
  sans ligne au verrou, 0 point pour la compétition (calcul en v0.15), sauf reprise du dernier
  alignement (#1034). Chacun ne lit que ses
  alignements. Codes : FT022 mercato pas fini, FT023 verrouillé, FT024 alignement invalide.
- Décisions du coordinateur (à revoir aux tests du propriétaire) : les remplaçants sont un **banc
  simple** en v1, sans remplacement automatique d'un titulaire qui ne court pas ; le chiffre de la
  carte reste le **prix payé** (les points de la saison viendront avec la v0.15). **Remplacé par
  la feuille de match ci-dessous (#1017).**

### Feuille de match et remplacements (décisions du propriétaire du 16 nov. 2026, #1017)

À construire ; tant que ce n'est pas livré, les règles ci-dessus restent en vigueur. Les familles,
les quotas, les 2 places par famille, la taille du banc et le diviseur sont livrés (#1030, voir
« Règles Manager à 4 familles » plus bas) ; la feuille de match est enregistrée et vérifiée
(#1032, voir « Feuille de match en base » plus bas) ; le calcul des remplacements est livré
(#1033, voir « Remplacements dans le score » plus bas), la reprise du dernier alignement aussi
(#1034, voir « Reprise du dernier alignement » plus bas) ; l'écran vient avec #1035.

- **Une seule action par compétition : aligner.** Le joueur n'a plus de pronostics à faire pour le
  Manager (section 4).
- **Feuille de match** : 8 titulaires (`lineup.max`), **4 remplaçants rangés** dans l'ordre, et le
  reste de l'équipe en **réserve**. Un réserviste ne joue jamais sur la compétition, même en
  dernier recours.
- **Une discipline par athlète** aligné, titulaire ou remplaçant : le joueur la choisit parmi les
  disciplines où l'athlète est sur une liste de départ de la compétition (sans liste de départ,
  celles de sa fiche) ; une seule possible, elle est pré-remplie. Seule cette discipline compte :
  la règle de la « meilleure ligne » disparaît.
- **Remplaçant désigné** : chaque titulaire peut avoir un remplaçant de la **même famille**
  (familles des places du stade : haies avec le sprint, les deux sauts ensemble), **homme ou
  femme**. Un remplaçant ne sert qu'à un titulaire.
- **Remplacement tactique** (facultatif) : un seuil de marque dans l'unité de la discipline
  (« si plus lent que 10"50 », « si moins de 8,00 m »), affiché aussi en points. Si le titulaire
  fait moins bien que le seuil, le remplaçant entre et c'est **sa** ligne qui compte, même si elle
  est moins bonne.
- **Titulaire DNS, DNF ou DQ** : son remplaçant désigné entre ; s'il n'a pas couru non plus (ou
  sans remplaçant désigné), le **premier remplaçant du banc de la même famille** qui n'est pas déjà
  entré ; sinon 0.
- **Familles, quotas et budget** (même décision) : 4 familles partout, équipe comme stade —
  **sprint** (100 à 400 m, haies), **demi-fond et fond** (800 m au marathon, steeple), **sauts**
  (les quatre, épreuves combinées comprises), **lancers**. Le stade : **2 places par famille**, sans
  place « Libre » ni contrainte de sexe. L'équipe : par famille au moins **1 femme et 1 homme**, au
  moins **3** au total, au plus **4 par sexe** ; taille minimum **12**. Budget **100**. Prix de
  départ indicatifs selon les points de la meilleure marque des 12 derniers mois : 20 (≥ 1 200),
  12 (1 150–1 199), 7 (1 100–1 149), 4 (1 050–1 099), 2 (en dessous) ; une équipe équilibrée coûte
  alors 75 à 90 au prix de départ. Prix proposé dans le back-office : #1028. Le catalogue doit
  compter au moins 200 athlètes avec un prix, environ 25 par famille et par sexe. Valeurs de départ
  à ajuster après les tests du propriétaire.
- **Oubli d'alignement** : au verrou, le **dernier alignement** du joueur est repris (titulaires,
  banc, disciplines et seuils), en ne gardant que les athlètes engagés ; une place que personne ne
  peut remplir reste vide. « Mes points » affiche « Alignement repris de … ». Sans aucun
  alignement précédent : 0.

### Feuille de match en base (#1032)

- `manager_lineups.athlete_ids` garde les titulaires dans l'ordre des places (scores, duels et
  rappels la lisent) ; `manager_lineup_entries` garde la feuille, une ligne par athlète aligné :
  rôle (`starter` et son ordre de place, ou `substitute` et son rang 1 à `lineup.bench`),
  discipline qui compte, et pour un titulaire son remplaçant désigné et son seuil tactique
  (facultatifs ; marque dans l'unité de la discipline, comme `athlete_records.mark_value`). Même
  verrou (FT023) et même lecture (chacun ne lit que ses lignes) que `manager_lineups` ; les
  alignements déjà validés deviennent des feuilles de titulaires, chacun dans sa première
  discipline.
- `save_manager_lineup(ligue, compétition, feuille jsonb)` et `lineupProblem`
  (`src/domain/manager-lineup.ts`) vérifient, en plus des règles de l'alignement (FT024) : la
  discipline parmi celles des listes de départ de l'athlète dans la compétition, relais exclus
  (sans liste de départ : celles de sa fiche ; sans choix, la première, la principale d'abord),
  FT036 ; remplaçant désigné de la même famille Manager, homme ou femme, FT037 ; sur le banc,
  FT038 ; pour un seul titulaire, FT039 ; seuil plausible pour la discipline
  (`discipline_mark_range`, `markRange`), FT040 ; au plus `lineup.bench` remplaçants, FT041 ;
  seuil sans remplaçant désigné, FT042 (décision de l'agent : un seuil sans remplaçant n'aurait
  aucun effet).
- `my_manager_sheet(ligue, compétition)` relit la feuille pour l'écran « Mon alignement » (#1035) :
  chaque athlète de l'équipe avec les disciplines où il peut compter (la première d'abord), et sa
  place sur la feuille (titulaire, remplaçant et son rang, ou rien : la réserve), discipline,
  remplaçant désigné et seuil. L'écran envoie toute la feuille ; les règles d'édition du banc
  (ajout, retrait, ordre, désignation) vivent dans `src/domain/manager-bench.ts`. Décisions de
  l'agent : choisir un réserviste comme remplaçant le met au bout du banc s'il reste de la place
  (sinon il n'est pas proposé) ; le désigner pour un titulaire le retire à celui qui l'avait ; un
  remplaçant renvoyé en réserve emporte la désignation et le seuil qui en dépendaient.

### Remplacements dans le score (#1033)

- `managerCompetitionScore` (`src/domain/manager-score.ts`) part de la feuille de match au
  verrou, que `admin_manager_scoring_sheet` donne pour chaque participant (titulaires dans l'ordre
  des places avec discipline, famille Manager, remplaçant désigné et seuil ; banc dans l'ordre).
  La famille est celle de l'athlète dans l'équipe (sa discipline principale), à défaut celle de la
  discipline qui compte ; un alignement sans lignes de feuille compte ses titulaires dans leur
  première discipline, sans remplaçant.
- Seule la discipline choisie compte ; dans cette discipline, la meilleure manche (séries et
  finale), sans cumul. Les places sont traitées dans l'ordre ; un remplaçant n'entre qu'une fois.
- Une **marque** : un arrivé dont la marque se lit. Seuil : le titulaire fait strictement moins
  bien (plus lent pour une course, moins loin ou moins haut, moins de points) ; à égalité il reste.
- Pour chaque place, le score dit qui a compté et pourquoi (`substitution` :
  `{starterId, reason}`, `tactical`, `forfeit` ou `bench`), absent quand le titulaire compte ; il
  est stocké dans `manager_scores.athletes` (`substitution: {starter_id, reason}`).
- Décisions de l'agent (à revoir aux tests du propriétaire) : un remplacement tactique n'a lieu
  que si le remplaçant désigné a une marque (sinon le titulaire garde sa place, et le remplaçant
  reste disponible) ; un remplaçant du banc n'entre que s'il a une marque ; sans personne, la
  ligne du titulaire reste (0 point).

### Reprise du dernier alignement (#1034)

- Chaque minute, pg_cron lance `private.manager_carry_over_lineups()`
  (`20261116140000_manager_lineup_carry_over.sql`) : pour chaque ligue et chaque compétition
  verrouillée, **une seule fois** (`manager_lineup_carry_overs`), un participant sans alignement
  reçoit une copie de son dernier alignement **validé par lui** (la compétition de la ligue
  verrouillée juste avant ; décision de l'agent : on ne recopie pas une copie, qui n'aurait que
  perdu des athlètes). Un alignement validé n'est jamais écrasé ; sans alignement validé avant :
  pas de ligne, 0 point.
- La copie ne garde que les athlètes de l'équipe engagés dans la compétition. Un athlète garde
  sa discipline s'il y est engagé, sinon prend la première où il l'est, sinon il est retiré. Un
  titulaire retiré laisse sa place à son remplaçant désigné, sinon au premier remplaçant du banc
  de la même famille (ceux désignés pour un titulaire resté passent en dernier) ; sinon la place
  reste vide. Un seuil ne reste qu'avec la même discipline et le même remplaçant ; le banc se
  resserre.
- La copie porte `manager_lineups.carried_from` ; `my_manager_lineups` rend son nom
  (`carried_from_name`) et « Mes points » affiche « Alignement repris de … ». Les compétitions déjà
  verrouillées à la migration ne sont pas reprises.

### Confrontation, « Mes points » et règles (#1036)

- Chaque ligne de `manager_scores.athletes` garde aussi les points des tables avant la division
  (`table_points`) et, pour un remplaçant, ce qu'a fait le titulaire (`substitution.starter` :
  marque, statut, points, seuil tactique écrit dans l'unité de la discipline). Pas de migration :
  les scores stockés avant restent lisibles, sans le calcul ni la note (prochain « Recalculer »).
- Confrontation : la carte d'une place remplacée est celle du remplaçant (↻ forfait, ⏱ tactique) ;
  « Place par place » donne marque, bonus et points des deux côtés, et sous une place remplacée ou
  restée à 0, ce qui s'est passé. « Mes points » : « Tables ÷ 10 », « Bonus », « Total », le
  calcul par athlète et « Sur le banc » (titulaires remplacés, remplaçants pas entrés, lus dans la
  feuille de match). Les règles de la ligue s'ouvrent dans une feuille, en quatre parties.
- Décision de l'agent : le gain affiché sous un remplacement tactique (« +9 pts ») est l'écart
  entre les points du remplaçant et ceux qu'aurait apportés le titulaire ; il peut être négatif.

### Règles Manager à 4 familles (#1030)

- Familles Manager (`ManagerFamily`, `managerFamilyOf` dans `src/domain/manager-rules.ts` ; en
  SQL `private.manager_family`) : `sprint` (sprint, haies), `distance` (demi-fond, fond),
  `jumps` (sauts horizontaux et verticaux, épreuves combinées), `throws` ; un relais n'en a pas.
  Les familles des disciplines (`DisciplineFamily`, jeu de pronos) ne changent pas. Les cartes de
  l'équipe, le stade et le filtre du catalogue utilisent ces 4 familles.
- Règles : `quotas` = une entrée par famille `{family, min, minPerSex, maxPerSex}` (1, 1 et 4 ;
  `min` 3), `minTeamSize` 12, budget 100, `lineup` = `{max: 8, perFamily: 2, bench: 4}` (`max`
  vaut toujours 4 × `perFamily`), `tablesDivisor` 10. `isPlayableManagerRules` refuse aussi une
  famille sans quota, un minimum de famille qui ne couvre pas ses places, titulaires et banc
  au-delà de la taille minimum, un diviseur qui n'est pas un entier positif. Back-office ›
  Manager : quotas par famille, places par famille, banc, diviseur.
- Migration `20261116110000_manager_four_families.sql` : nouvelles valeurs par défaut (les
  tours, clôtures, bonus et saison de l'admin restent) ; une ligue dont le mercato n'a pas ouvert
  reprend les règles en vigueur (en gardant ses tours) ; les autres gardent les leurs, converties :
  par famille, `min` = somme des minimums des deux sexes, `minPerSex` = la plus petite somme d'un
  sexe, `maxPerSex` = la plus grande somme des maximums ; `perFamily` = `lineup.max` ÷ 4 (au moins
  1), `bench` 4, `tablesDivisor` 10.

## 4. Points (v0.15)

**Score d'une compétition = points des tables ÷ `tablesDivisor` (10, entier inférieur, par
athlète) + bonus sportifs**, sans les pronostics (décision du 16 nov. 2026, #1017, livrée par
#1031). Jusque-là : barème hongrois brut + bonus + points de pronostics. Voir « Équilibre des
points » en fin de section.

- **Barème hongrois** (« tables World Athletics ») : chaque athlète aligné rapporte des points selon sa performance réelle ;
  la place n'entre pas dans ce calcul. Tables World Athletics (#428) ; DNS, DNF, DQ = 0 point.
  Calcul : `src/domain/world-athletics-points.ts`, à partir de la discipline, du sexe, de la
  performance (secondes, mètres, ou total officiel pour les épreuves combinées) et du lieu de la
  compétition : en salle, tables « piste courte » (#1026, voir les réponses de #428).
- **Bonus sportifs**, tous cumulables, valeurs fixées par l'admin : 1re, 2e, 3e place, record
  personnel, meilleure performance de la saison, record national, continental et du monde.
  Calcul : `src/domain/manager-bonus.ts`, à partir de la place (aucune pour DNS, DNF, DQ) et des
  records cochés par l'admin ; chaque record compte s'il est coché (un record du monde ne coche
  pas les autres de lui-même).
- **Saisie** : l'admin entre places, performances et indicateurs de records ; le calcul est
  automatique.
- Saisie (#429, puis #665 : une seule feuille par épreuve, décision du propriétaire du
  13 nov. 2026), back-office › épreuve › « Feuille de résultats » (`/admin/<épreuve>/performances`),
  une fois l'épreuve commencée : pour chaque athlète de la liste de départ, un statut (arrivé, DNS,
  DNF, DQ, ou non saisi), la place (les ex æquo la partagent ; les places 1 à 3 font le podium
  officiel des pronos), la marque (un arrivé a une place ou une marque ; sans marque, 0 point des
  tables ; lue dans l'unité de la discipline et récrite comme les autres) et les records
  RP, MPS, RN, RC, RM. Un DNS, DNF ou DQ n'a que son statut. Les athlètes alignés dans au moins une
  ligue Manager pour la compétition viennent en tête, signalés « à saisir » tant qu'ils n'ont pas de
  ligne, avec le compte de ceux qui manquent (un aligné sans performance compte 0). Sans ligue
  Manager sur la compétition, la feuille le dit : le podium suffit. Une nouvelle saisie remplace la
  précédente : un résultat corrigé se saisit à nouveau, et tout est recalculé (#416). En base :
  table `event_performances`, lecture publique, écriture seulement par `admin_set_performances`
  (journalisée `set_performances` dans `admin_actions`), qui remplace aussi `results` par les
  arrivés classés 1 à 3 ; `admin_manager_lined_up` dit à l'admin seul quels athlètes de la liste sont
  alignés, titulaires et remplaçants du banc, pas les réservistes (#1053 ; les alignements
  restent privés). Règles pures : `src/domain/performance.ts`.
- **Pronostics classiques obligatoires** (retirés le 16 nov. 2026, #1017) sur toutes les épreuves de chaque compétition éligible,
  verrouillés au départ ;
  sans pronostic, 0 sur cette partie.
- Calcul (#431, automatique depuis #665) : chaque feuille de résultats enregistrée calcule les
  points des pronos de l'épreuve, puis les scores Manager de la compétition ; « Recalculer les
  points Manager » (back-office › compétition) relance le même calcul en secours. Il remplace tous
  les scores de la compétition. Tant qu'une épreuve de la compétition n'a pas de résultat, les
  scores sont provisoires : la confrontation s'affiche, elle ne compte au classement (et ne clôt la
  saison) qu'une fois toutes les épreuves saisies. Pour chaque participant d'une ligue dont le mercato
  est clos : sans alignement, 0 au total ; sinon, pour chaque titulaire, les points des tables
  divisés par le diviseur de la ligue, à l'entier inférieur (0 pour DNS, DNF, DQ, sans performance
  saisie, marque illisible ou discipline sans table), plus ses bonus. Les points de pronos ne
  comptent plus (#1031) : la colonne `predictions` de `manager_scores` reste, toujours à 0.
  Règles pures : `src/domain/manager-score.ts` ; en base : `manager_scores`
  (lecture par les participants de la ligue). Écran « Mes points » :
  `/manager/<id>/points/<compétition>`, depuis l'alignement verrouillé ; le détail des titulaires va
  du plus fort au plus faible, les bonus en étiquettes dorées.
- Décisions du coordinateur (la « meilleure ligne » est remplacée par la discipline choisie à
  l'alignement, #1017, livrée par #1033) : un athlète engagé dans plusieurs
  épreuves de la compétition (séries et finale, deux disciplines) rapporte sa **meilleure ligne**,
  sans cumul ; les bonus de place (1re, 2e, 3e) ne comptent qu'en **finale**, un record battu en
  série compte. « Mes points » ne mène pas encore à la journée : on y va par la page de la ligue
  (« Journée ») ou le classement.
- Cas chiffrés de référence (tables, bonus, score d'une compétition) : `docs/architecture.md`,
  « Cas de test du cœur », M1 à M14.

### Équilibre des points (décisions du propriétaire du 16 nov. 2026, #1017)

Livré par #1031 (score) ; la migration `20261116120000_manager_score_divisor.sql` a recalculé
les scores déjà stockés (tables ÷ diviseur, pronos à 0).

- **Constat** (barème des migrations) : un athlète vaut 900 à 1 250 points des tables, 8 titulaires
  environ 8 500. Sur 20 000 confrontations simulées, l'écart médian des tables est d'environ
  450 points, celui des bonus 8 et celui des pronos 12 à 57 : les bonus changent le vainqueur dans
  moins de 1 % des cas, et 0,09 s sur un 100 m (30 points) pèse plus que trois titres.
- **Points des tables ÷ 10**, arrondis à l'entier inférieur pour chaque athlète (un athlète vaut
  environ 100). Le diviseur est une règle de la ligue (`tablesDivisor`, 10), figée à la création ;
  les ligues déjà créées passent à 10 aussi (la saison n'a pas commencé).
- **Bonus inchangés** et automatiques, lus dans la feuille de résultats : 1re 10, 2e 6, 3e 3 (en
  finale), RP 5, MPS 3, RN 10, RC 15, RM 25 (en série aussi). Un titre vaut environ 0,3 s sur
  100 m. Le joueur n'a rien à saisir.
- **Plus de pronostics dans le Manager** : ni obligatoires, ni comptés. Le jeu de pronos et ses
  ligues restent à part. La seule action du joueur pour une compétition est l'alignement
  (section 3).
- Exemple de référence (championnats de France, marques réalistes, tout le monde au départ) :
  l'équipe A, plus rapide sur le papier sans titre, faisait 8 956 + 15 bonus ; l'équipe B, quatre
  titres, 8 687 + 66 : A gagnait de 218. Avec ÷ 10 : A 892 + 15 = 907, B 865 + 66 = 931, B gagne
  de 24.

## 5. Championnat (v0.16)

- **Aller-retour** : chaque participant affronte tous les autres deux fois, à domicile puis à
  l'extérieur ; calendrier généré au lancement de la saison, fixe ensuite.
- Calendrier (#432) : tiré à la **clôture du mercato** (début de la saison), quelle que soit la
  façon dont il se clôt (déclencheur sur `manager_leagues.mercato_closed_at`), une seule fois :
  une ligue qui a un calendrier le garde. Tables `manager_matchdays` (journée, compétition,
  bonus) et `manager_fixtures` (journée, domicile, extérieur), lues par les participants de la
  ligue, écrites par personne d'autre que `private.schedule_manager_season`. Les joueurs sont
  tirés dans un ordre au hasard (`random()`, `setseed()` dans pgTAP), puis placés par la méthode
  du cercle (`seasonSchedule`,
  `src/domain/manager-schedule.ts`, même règle en SQL) : 2 × (n − 1) journées, chacun un
  adversaire par journée, chaque paire deux fois, une fois à domicile chacun ; jamais trois
  journées de suite à domicile ou à l'extérieur, jamais le même adversaire deux journées de
  suite. Le retour reprend les paires de l'aller, domicile et extérieur inversés, en commençant
  par la 2e journée de l'aller (la 1re vient en dernier). Rien avec un nombre impair de joueurs.
- **Compétitions de la saison** (règle du propriétaire, 13 nov. 2026, #432) : celles de la
  ligue dont la **première épreuve commence au moins 1 h après la fin du mercato** (une
  compétition sans épreuve compte à partir de minuit, heure de Paris, de sa date de début), dans l'ordre des
  dates (première épreuve, puis nom). Une compétition qui commence plus tôt ne compte pas.
- **Une compétition = une journée** (réponse du propriétaire, 10 nov. 2026, #440) : les
  compétitions de la saison vont aux journées 1, 2, 3… Les 2 × (n − 1) premières sont des
  journées de confrontation ; **les compétitions en trop, à la fin, sont des journées bonus**
  (`bonus`) : points du Manager seulement, sans confrontation ni points de classement. Le nombre
  de joueurs vient des compétitions (#644) : il y en a toujours assez au lancement. Si la règle
  de la fin du mercato en retire trop, une journée de confrontation au-delà de la dernière
  compétition n'en a pas (`competition_id` nul) et ne se joue pas.
- **Une confrontation par compétition éligible** : le score total le plus haut gagne, égalité =
  nul. **Victoire 3 points, nul 1, défaite 0** (distincts des points Manager).
- **Classement** : points au championnat, puis victoires, puis différence de points Manager
  (marqués moins encaissés), puis points Manager marqués.
- Résultats et classement (#433) : calculés à la lecture (`src/domain/manager-championship.ts`),
  rien n'est stocké. Une confrontation est jouée dès que les scores Manager de sa compétition sont
  calculés ; un participant sans score y compte pour 0. Égalité complète (points, victoires,
  différence, marqués) : même rang. Les journées bonus n'ont ni confrontation ni points de
  classement, et ne comptent ni dans V/N/D ni dans la différence.
- Écrans (#433) : `/manager/<id>/journee/<n>` (sans numéro : la journée en cours) montre les
  confrontations de la journée avec leurs scores, ou « Journée bonus » ; `/manager/<id>/classement`
  le classement (rang, points, V/N/D, différence, marqués). On y va depuis la page de la ligue.
- **Confrontation** (#605) : `/manager/<id>/confrontation/<n>/<domicile>`, ouverte depuis chaque
  carte de la journée, montre les deux alignements sur le stade (l'adversaire en haut, le joueur en
  bas ; pour un membre hors confrontation, l'extérieur en haut) avec les points de chaque athlète.
  Un alignement reste secret jusqu'au verrou de sa compétition ; ensuite tout participant de la
  ligue lit tous les alignements de cette compétition (`manager_duel_lineups`), les points par
  athlète venant de `manager_scores.athletes`.
- **Fin de saison** quand toutes les confrontations sont jouées et validées, sans playoffs : le
  premier est champion, le classement est figé.
- **Palmarès** conservé : champion, classement final, statistiques individuelles, victoires / nuls
  / défaites, points Manager marqués, historique des confrontations directes.
- Fin de saison (#434, décision du propriétaire du 13 nov. 2026) : la saison se termine après la
  **dernière journée du calendrier, journées bonus comprises** : quand chaque journée qui a une
  compétition a ses scores Manager (une journée sans compétition ne se joue pas et ne retient
  rien). Un déclencheur sur `manager_scores` fige alors le palmarès dans `manager_honours`, une
  seule fois : champion (premier du classement ; égalité complète : le premier arrivé dans la
  ligue), classement final, confrontations, points Manager marqués (journées bonus comprises) et
  meilleur athlète de chacun (le plus de points Manager sur la saison). Un score recalculé
  ensuite (#416) ne change plus le palmarès. Le « principal rival » de l'écran de fin de saison
  est le joueur juste devant au classement final (le 2e pour le champion). Nouvelle saison =
  nouvelle ligue, nouveau mercato ; le palmarès reste dans le profil. Écran :
  `/manager/<id>/fin-de-saison` (rang final, « Ma saison », bilan face au rival), annoncé sur le
  classement une fois la saison finie.

## 6. Accueil et tutoriel (v0.16)

- **Ma saison** (#606) : un joueur qui a une ligue Manager voit sur `/manager`, pour sa première
  ligue, le nom de la ligue, la journée N sur M, son rang et son bilan (points, V/N/D,
  différence), sa prochaine confrontation (adversaire, domicile ou extérieur), l'action du moment
  (aligner pour la prochaine compétition, voir ses derniers points) et « Le déroulé de la
  saison » en sept étapes : ligue, mercato, équipe, alignement, points, confrontations, champion.
  L'étape en cours vient de l'état de la ligue (`currentSeasonStep`, `src/domain/manager-home.ts`) :
  « ligue » tant que le mercato attend ses joueurs, « mercato » pendant qu'il est ouvert, puis
  « alignement » tant que la prochaine compétition attend un alignement, « points » une fois
  l'alignement validé ou verrouillé jusqu'au calcul, « confrontations » après une journée calculée,
  « champion » à la fin de la saison. Les quatre étapes du milieu reviennent à chaque journée. Cas
  d'usage : `getManagerHome`, `src/application/manager-home.ts`.
- **Tutoriel « Comment ça marche ? »** (#616, raccourci par #802) : trois écrans plein écran (le
  principe : recrute, aligne, affronte tes amis ; la saison : mercato puis journées ; l'action :
  créer ou rejoindre une ligue), chacun avec un dessin en formes simples. Il s'ouvre seul à la
  première visite de `/manager` (vu, mémorisé sur l'appareil), puis à la demande par « Comment ça
  marche ? » (`/manager?tutoriel=1`) ; « Passer » à tout écran. Aucun chiffre : ils sont dans
  « Règles de la ligue », lus dans les règles figées de la ligue. La navigation suit le contenu,
  sans vide jusqu'au bas de l'écran, et le tutoriel s'ouvre sans focus visible sur « Passer »
  (#709).

## 7. Jokers Manager (v0.24, #1091)

Un joker par confrontation, chacun une fois dans la saison, choisi avec l'alignement, découvert par
l'adversaire au verrou. Règles et calcul : `docs/architecture.md`, « Jokers Manager » et cas M24.

## Réponses du propriétaire (#416, 10 novembre 2026)

- **DNS, DNF, DQ**, performance invalide ou résultat officiel manquant : l'athlète reste aligné et
  rapporte **0 point**.
- **Résultat corrigé** après la première saisie : **recalcul complet** du score de la compétition,
  des confrontations déjà jouées et du classement.
- **Clôture du mercato** : l'**admin de la ligue** choisit la date et le mode de clôture parmi
  ceux que l'admin de French Track Prono autorise.
- **Barème hongrois** : tables de cotation **World Athletics**. Le droit de les embarquer dans
  l'app reste à vérifier dans #428.
- **Saisie des performances** : au minimum celles des athlètes alignés par au moins un
  participant ; l'admin peut aussi saisir tous les résultats de la compétition pour qu'ils
  soient visibles dans l'app.
- **Pronostics obligatoires** : ceux de **toutes les épreuves** pronostiquables de la compétition.
  Retirés le 16 nov. 2026 (#1017) : les pronos ne comptent plus dans le Manager.
- **Monnaie** : crédits virtuels uniquement, rien de payant. Le mercato secondaire payant est hors
  périmètre.

## Réponse du propriétaire (#441, 11 novembre 2026)

- **Prix de référence** : fixé à la main par l'admin, attribut de l'athlète (back-office ›
  Athlètes › fiche, « Prix French Track Manager »). Un athlète sans prix n'est pas dans le
  catalogue. Le prix servira aussi au futur onglet athlète (#443).
- **Prix proposé** (#1028, décision du 16 nov. 2026, #1017) : la fiche montre un prix calculé,
  que l'admin reprend (« Reprendre ce prix ») ou corrige ; seul le prix saisi compte au catalogue
  et aux enchères. Règle dans `src/domain/manager-price.ts` : meilleure marque des 12 derniers mois
  dans la discipline principale (RP ou MPS daté), sinon le RP dégradé de 5 % ; points des tables
  World Athletics, puis grille (≥ 1 200 → 20, ≥ 1 150 → 12, ≥ 1 100 → 7, ≥ 1 050 → 4, sinon 2) ;
  état `doubtful` ou `out` × 0,5, présence en France `rarely` × 0,6 ; arrondi, jamais sous 1.
  Sans marque ni table : pas de proposition. La fiche porte l'état (`fit` par défaut, `doubtful`,
  `out`) et la présence en France (`often`, `sometimes` par défaut, `rarely`), journalisés comme
  `edit_athlete`. Grille et coefficients : règles Manager du back-office (`pricing`).

## Réponses du propriétaire (#428, 12 novembre 2026)

- **Tables de cotation World Athletics** : elles peuvent être récupérées et embarquées dans l'app.
  Édition **2025**, coefficients repris de la bibliothèque GlaivePro/IaafPoints (licence MIT,
  commit épinglé), formule `points = floor(a × (perf + b)² + c)`. Le script
  `scripts/world-athletics-tables.mjs` les importe dans `src/domain/world-athletics-tables.ts`,
  fichier généré et versionné ; une nouvelle édition = changer l'édition et le commit dans le
  script, le relancer, vérifier les valeurs de référence des tests.
- **Épreuves combinées** : pas de tables du décathlon ou de l'heptathlon par épreuve. La
  performance saisie est le total officiel, converti par les tables comme toute autre épreuve.
- Chronométrage électronique seulement (pas de correction manuelle). Une discipline absente des
  tables (relais mixte 4 × 100 m, ou créée par l'admin sous un autre nom) n'a pas de barème : le
  calcul renvoie « pas de table ».
- **Salle** (décision du 16 nov. 2026, #1026, remplace ici « pas de tables piste courte ») : la
  salle reste dans le Manager. Une compétition en salle (`venue = 'indoor'`, celle du filtre
  « Saison en salle ») prend la table `<épreuve>_short` d'une course quand elle existe (200 m,
  300 m, 400 m, 500 m, 600 m, 800 m, 1000 m, 1500 m, mile, 2000 m, 3000 m, 2 miles, 5000 m,
  relais 4 × 200 m, 4 × 400 m et mixte 4 × 400 m), sinon la table de plein air. Le 50 m, le
  55 m, le 60 m et leurs haies n'ont qu'une table, la même partout ; le 3000 m plat a aussi sa
  table de plein air. Pentathlon (femmes) et heptathlon (hommes) en salle ont leurs tables ;
  sauts et lancers : même table dedans et dehors. La feuille de calcul SQL
  (`admin_manager_scoring_sheet`) transmet `indoor` ; le calcul reste celui du cœur. Les scores
  déjà stockés d'une compétition en salle changent au prochain « Recalculer ».

## Réponse du propriétaire (#440, 10 novembre 2026)

- **Compétitions et journées** : une compétition éligible = une journée, chaque participant y a
  un adversaire. Il en faut au moins 2 × (n − 1) pour n participants (#644 en déduit le nombre de
  joueurs). Les autres options (une compétition pour plusieurs journées, aller simple quand les
  compétitions manquent) sont écartées.
- **Compétitions en trop** (13 novembre 2026, #432) : des journées bonus à la fin, sans
  confrontation (section 5).

## Questions encore ouvertes

- Aucune : #440 a sa réponse (« Une compétition = une journée », section 5).
