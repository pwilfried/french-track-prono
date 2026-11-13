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
  `private.open_manager_mercatos`, lancé par le job « Manager rounds », ouvre ceux dont la date est
  passée ; tous deux exigent la cible atteinte et assez de compétitions après la fin prévue
  (`private.manager_season_fits`). Codes : FT015 mercato déjà ouvert, FT026 joueurs manquants,
  FT027 compétitions refusées (moins de 6, indisponibles, ou moins de joueurs que d'inscrits),
  FT028 pas assez de compétitions après la fin prévue du mercato. Les ligues créées avant gardent
  leurs compétitions et leur cible. Règles pures : `seasonFormat`, `seasonCompetitions`,
  `hasEnoughCompetitions`, `src/domain/manager-league.ts`.
- **Présentation du mode** (#618) : un joueur sans ligue Manager voit sur `/manager` une courte
  présentation (qu'il peut passer) avant de créer ou rejoindre une ligue. Ses chiffres (budget, taille minimum
  d'équipe, titulaires, bonus de victoire) sont lus dans les règles de l'admin
  (`managerIntroFigures`, `src/domain/manager-intro.ts`), jamais écrits dans le texte.
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
- **Tours** : en durée « automatique », celle des règles French Track (au départ 48 h pour les
  tours 1 et 2, 24 h ensuite) ; en durée « personnalisée », celle choisie par le créateur (#619).
- Clôture des tours (#423) : les tours s'enchaînent depuis `mercato_opened_at`, durées prises dans
  les règles de la ligue (`rounds`). Le workflow « Manager rounds » lance
  `private.close_manager_rounds()` toutes les 5 minutes (comme les notifications push) : pour
  chaque tour échu, l'offre la plus haute gagne, à égalité la plus ancienne à ce montant
  (`awardBids`, `src/domain/manager-round.ts`, même règle en SQL) ; toutes les offres de la ligue
  sont ensuite effacées (les gagnantes deviennent des `manager_awards`, les perdantes sont
  libérées). Rejouer ne ferme rien deux fois (`manager_rounds`, clé primaire sur
  `manager_awards`). Entre la fin d'un tour et le passage du job, les offres attendent (FT020).
  Le budget disponible est le budget moins les athlètes gagnés ; un athlète gagné n'est plus
  « Libre » dans le catalogue. Dans `manager_awards`, un joueur lit ses propres athlètes ; ceux
  des autres et leur prix se lisent depuis #604 dans la révélation de fin de tour ; le panneau « Mon budget » montre le dépensé, la fin du tour et « Mes
  athlètes ».
- **Clôture du mercato**, de trois façons : plus aucun participant n'a de budget (après
  résolution des offres en cours) ; le dernier participant qui a encore du budget décide d'y
  mettre fin ; date programmée par les règles.
- **Pas de taille maximum d'équipe** (décision du propriétaire, 12 nov. 2026, #607) : on recrute
  autant d'athlètes que le budget le permet, dans les quotas. L'admin fixe seulement une **taille
  minimum** (`minTeamSize`, figée par ligue comme les autres règles) ; elle doit couvrir
  l'alignement (`lineup.max` ≤ `minTeamSize`). Les ligues créées avant gardent leurs règles : la
  migration de #607 renomme leur `teamSize` en `minTeamSize`.
- Clôture du mercato (#424, #607), selon les `closeModes` des règles de la ligue. « Peut
  recruter » : le budget restant (budget moins les athlètes
  gagnés, les offres en cours ne comptent pas) paie l'athlète libre le moins cher du catalogue
  (`canRecruit`, `src/domain/manager-mercato.ts` ; même règle en SQL,
  `private.manager_recruiters`). Le job « Manager rounds » clôt, après les tours échus, le mercato
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
  son prix de référence tient dans le budget restant et si son sexe et sa famille ont un quota
  (`quotas`) pas encore au maximum (une famille sans quota ne se recrute pas). Les équipes
  reçoivent un athlète chacune à tour de rôle (ordre des identifiants), tiré au hasard parmi ceux
  qui leur conviennent, jusqu'à ce qu'aucune ne puisse plus en recevoir. Les athlètes donnés
  forment un dernier tour (`manager_rounds`), au prix de référence. Puis chaque équipe reçoit
  `manager_members.team_compliant` : vrai si elle atteint le minimum de chaque quota, faux
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
  la ligue. Le stade compte `lineup.max` places : pour chaque famille de `lineup.minPerFamily`,
  autant de places (haies avec le sprint, les deux sauts ensemble, comme sur les cartes), le reste
  en places « Libre » (toutes familles). Un alignement valide : des athlètes de son équipe, chacun
  une fois, **engagés** dans la compétition (`competition_athletes`, back-office ou liste de
  départ), et toutes les places que l'équipe peut remplir sont remplies ; une place que personne
  ne peut remplir (équipe incomplète, athlètes absents) reste vide sans bloquer
  (`lineupProblem`, `src/domain/manager-lineup.ts` ; même règle en SQL dans
  `save_manager_lineup`). Le **verrou** est le premier verrou des pronos de la compétition (à
  défaut d'épreuve, minuit heure de Paris le premier jour) ; un déclencheur refuse toute écriture
  dans `manager_lineups` après (FT023). Une ligne de `manager_lineups` est un alignement validé :
  sans ligne au verrou, 0 point pour la compétition (calcul en v0.15). Chacun ne lit que ses
  alignements. Codes : FT022 mercato pas fini, FT023 verrouillé, FT024 alignement invalide.
- Décisions du coordinateur (à revoir aux tests du propriétaire) : les remplaçants sont un **banc
  simple** en v1, sans remplacement automatique d'un titulaire qui ne court pas ; le chiffre de la
  carte reste le **prix payé** (les points de la saison viendront avec la v0.15).

## 4. Points (v0.15)

**Score d'une compétition = points du barème hongrois + bonus sportifs + points de pronostics.**

- **Barème hongrois** (« tables World Athletics ») : chaque athlète aligné rapporte des points selon sa performance réelle ;
  la place n'entre pas dans ce calcul. Tables World Athletics (#428) ; DNS, DNF, DQ = 0 point.
  Calcul : `src/domain/world-athletics-points.ts`, à partir de la discipline, du sexe et de la
  performance (secondes, mètres, ou total officiel pour les épreuves combinées).
- **Bonus sportifs**, tous cumulables, valeurs fixées par l'admin : 1re, 2e, 3e place, record
  personnel, meilleure performance de la saison, record national, continental et du monde.
  Calcul : `src/domain/manager-bonus.ts`, à partir de la place (aucune pour DNS, DNF, DQ) et des
  records cochés par l'admin ; chaque record compte s'il est coché (un record du monde ne coche
  pas les autres de lui-même).
- **Saisie** : l'admin entre places, performances et indicateurs de records ; le calcul est
  automatique.
- Saisie (#429), back-office › épreuve › « Performances Manager » (`/admin/<épreuve>/performances`),
  une fois l'épreuve commencée : pour chaque athlète de la liste de départ, un statut (arrivé, DNS,
  DNF, DQ, ou non saisi), la place (facultative, les ex æquo la partagent), la marque (obligatoire
  pour un arrivé, lue dans l'unité de la discipline et récrite comme les autres) et les records
  RP, MPS, RN, RC, RM. Un DNS, DNF ou DQ n'a que son statut. Les athlètes alignés dans au moins une
  ligue Manager pour la compétition viennent en tête, signalés « à saisir » tant qu'ils n'ont pas de
  ligne, avec le compte de ceux qui manquent. Une nouvelle saisie remplace la précédente : un
  résultat corrigé se saisit à nouveau, et le calcul repartira de cette saisie (#416). En base :
  table `event_performances`, à part de `results` (le podium des pronos ne change pas), lecture
  publique, écriture seulement par `admin_set_performances` (journalisée `set_performances` dans
  `admin_actions`) ; `admin_manager_lined_up` dit à l'admin seul quels athlètes de la liste sont
  alignés (les alignements restent privés). Règles pures : `src/domain/performance.ts`.
- **Pronostics classiques obligatoires** sur toutes les épreuves de chaque compétition éligible,
  verrouillés au départ ;
  sans pronostic, 0 sur cette partie.
- Calcul (#431) : back-office › compétition › « Calculer les points Manager », possible une fois
  les alignements verrouillés ; à relancer après une correction (performances ou pronos), il
  remplace tous les scores de la compétition. Pour chaque participant d'une ligue dont le mercato
  est clos : sans alignement, 0 au total (pronos compris) ; sinon, pour chaque titulaire, les
  points des tables (0 pour DNS, DNF, DQ, sans performance saisie, marque illisible ou discipline
  sans table) plus ses bonus, puis la somme des points de pronos du joueur sur la compétition
  (`score_events`). Règles pures : `src/domain/manager-score.ts` ; en base : `manager_scores`
  (lecture par les participants de la ligue). Écran « Mes points » :
  `/manager/<id>/points/<compétition>`, depuis l'alignement verrouillé ; le détail des titulaires va
  du plus fort au plus faible, les bonus en étiquettes dorées.
- Décisions du coordinateur (à revoir aux tests du propriétaire) : un athlète engagé dans plusieurs
  épreuves de la compétition (séries et finale, deux disciplines) rapporte sa **meilleure ligne**,
  sans cumul ; les bonus de place (1re, 2e, 3e) ne comptent qu'en **finale**, un record battu en
  série compte. Le lien vers la journée viendra avec #433.
- Cas chiffrés de référence (tables, bonus, score d'une compétition) : `docs/architecture.md`,
  « Cas de test du cœur », M1 à M12.

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
- **Fin de saison** quand toutes les confrontations sont jouées et validées, sans playoffs : le
  premier est champion, le classement est figé.
- **Palmarès** conservé : champion, classement final, statistiques individuelles, victoires / nuls
  / défaites, points Manager marqués, historique des confrontations directes.

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
- **Monnaie** : crédits virtuels uniquement, rien de payant. Le mercato secondaire payant est hors
  périmètre.

## Réponse du propriétaire (#441, 11 novembre 2026)

- **Prix de référence** : fixé à la main par l'admin, attribut de l'athlète (back-office ›
  Athlètes › fiche, « Prix French Track Manager »). Un athlète sans prix n'est pas dans le
  catalogue. Le prix servira aussi au futur onglet athlète (#443).

## Réponses du propriétaire (#428, 12 novembre 2026)

- **Tables de cotation World Athletics** : elles peuvent être récupérées et embarquées dans l'app.
  Édition **2025**, coefficients repris de la bibliothèque GlaivePro/IaafPoints (licence MIT,
  commit épinglé), formule `points = floor(a × (perf + b)² + c)`. Le script
  `scripts/world-athletics-tables.mjs` les importe dans `src/domain/world-athletics-tables.ts`,
  fichier généré et versionné ; une nouvelle édition = changer l'édition et le commit dans le
  script, le relancer, vérifier les valeurs de référence des tests.
- **Épreuves combinées** : pas de tables du décathlon ou de l'heptathlon par épreuve. La
  performance saisie est le total officiel, converti par les tables comme toute autre épreuve.
- Chronométrage électronique et piste de 400 m seulement (pas de correction manuelle, pas de
  tables « piste courte »). Une discipline absente des tables (relais mixte 4 × 100 m, ou créée
  par l'admin sous un autre nom) n'a pas de barème : le calcul renvoie « pas de table ».

## Réponse du propriétaire (#440, 10 novembre 2026)

- **Compétitions et journées** : une compétition éligible = une journée, chaque participant y a
  un adversaire. Il en faut au moins 2 × (n − 1) pour n participants (#644 en déduit le nombre de
  joueurs). Les autres options (une compétition pour plusieurs journées, aller simple quand les
  compétitions manquent) sont écartées.
- **Compétitions en trop** (13 novembre 2026, #432) : des journées bonus à la fin, sans
  confrontation (section 5).

## Questions encore ouvertes

- Aucune : #440 a sa réponse (« Une compétition = une journée », section 5).
