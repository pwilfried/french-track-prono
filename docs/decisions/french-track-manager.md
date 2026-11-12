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

## Accès : les admins seulement (v0.14.1)

Décision du propriétaire du 12 novembre 2026 (#615) : tant qu'il ne l'ouvre pas à tous (décision à
part, dans sa propre issue), **seuls les admins** voient et jouent French Track Manager.

- Un joueur non admin n'en voit aucune trace : 4 onglets (Accueil, Épreuves, Classement, Ligues),
  pas de bloc Manager sur l'accueil, et les pages `/manager…` renvoient la page 404. Un admin a
  5 onglets, avec Manager.
- La règle vit dans `src/domain/manager-access.ts` (`seesManager`). Les actions serveur Manager
  refusent un non-admin avec le code `MANAGER_CLOSED`.
- En base, `private.require_manager_player()` est appelée par les fonctions qu'un joueur appelle
  pour créer ou rejoindre une ligue, enchérir, clore le mercato, aligner ou marquer une révélation
  vue : un non-admin reçoit FT025, même s'il est déjà dans une ligue.

## 1. Ligue et règles (v0.12)

- Un joueur crée une ligue, en devient l'administrateur, choisit son nom et sa visibilité :
  **publique** (inscription libre dans la limite des places) ou **privée** (sur invitation du
  créateur). Il voit la liste des participants.
- **4 à 12 participants, en nombre pair.**
- L'**admin de French Track Prono** fixe les règles générales : budget initial, quotas de
  composition des équipes (ex. sprinteurs hommes et femmes, demi-fond, fond, lancers), règles de
  recrutement, notation, bonus sportifs, compétitions éligibles, calendrier, durée des enchères,
  clôture du mercato, règles d'alignement.
- Le créateur d'une ligue ne choisit pas les compétitions.
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
- **Tours** : 48 h pour les tours 1 et 2, 24 h ensuite.
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

- **Barème hongrois** : chaque athlète aligné rapporte des points selon sa performance réelle ;
  la place n'entre pas dans ce calcul. Tables World Athletics (#428) ; DNS, DNF, DQ = 0 point.
- **Bonus sportifs**, tous cumulables, valeurs fixées par l'admin : 1re, 2e, 3e place, record
  personnel, meilleure performance de la saison, record national, continental et du monde.
- **Saisie** : l'admin entre places, performances et indicateurs de records ; le calcul est
  automatique.
- **Pronostics classiques obligatoires** sur toutes les épreuves de chaque compétition éligible,
  verrouillés au départ ;
  sans pronostic, 0 sur cette partie.

## 5. Championnat (v0.16)

- **Aller-retour** : chaque participant affronte tous les autres deux fois, à domicile puis à
  l'extérieur ; calendrier généré au lancement de la saison, fixe ensuite.
- **Une confrontation par compétition éligible** : le score total le plus haut gagne, égalité =
  nul. **Victoire 3 points, nul 1, défaite 0** (distincts des points Manager).
- **Classement** : points au championnat, puis victoires, puis différence de points Manager
  (marqués moins encaissés), puis points Manager marqués.
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

## Questions encore ouvertes

- Compétitions éligibles face aux 2 × (n − 1) journées d'un aller-retour : #440 (bloque #432).
