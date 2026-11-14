# Design et expérience

## Principes

1. **Mobile d'abord.** On pronostique dans le métro, pas devant un écran 27".
2. **3 taps pour un prono.** Choisir ses 3 athlètes doit prendre moins de 20 secondes.
3. **Le suspense avant tout.** Compte à rebours avant verrouillage, pronos des autres cachés
   puis révélés d'un coup.
4. **Le chambrage est une fonctionnalité.** Réactions emoji, phrases drôles, classement qui bouge.
5. **Récompenser l'audace**, pas seulement les favoris.
6. **Jamais de page vide.** Chaque état vide a un message amusant et une action claire.

## Identité visuelle

Charte tirée du logo FrenchTrack : un bleu profond en dégradé, un rouge vif, du blanc.

**Direction « Officiel »** (adoptée par le propriétaire le 7 nov. 2026, proposée dans #185) :
le logo FrenchTrack (`public/brand/frenchtrack.png`, version contour pour les en-têtes bleus)
suivi de l'étiquette rouge « Prono » ; des étiquettes de statut (`ChipStatus`, six tons :
neutre, marque, or, ok, chaud, discret) sur des fonds doux (`--*-soft` / `--*-ink`, contrastes
AA dans les deux thèmes) ; une carte d'épreuve en grille « heure | discipline | statut » ; un
podium officiel en dégradés or, argent, bronze (`--medal-*`). Un visiteur ne voit pas
« À pronostiquer » : seulement le compte à rebours.

| Rôle | Couleur | Usage |
|---|---|---|
| Bleu FrenchTrack | `#084595` | Fond des écrans d'accueil, liens et éléments de marque en mode clair |
| Nuit | `#052B5C` | Départ du dégradé, texte en mode clair, fond du mode sombre |
| Rouge | `#E03020` | Actions principales (texte blanc dessus, contraste 4,55:1) |
| Blanc | `#F8F8F8` | Fond clair, texte sur bleu |
| Or (accent fonctionnel) | `#FFC857` | Victoires, joker, 1re place |
| Vert (accent fonctionnel) | `#2BB673` | Points gagnés, bons pronos |

Règles de contraste (AA) : le rouge `#E03020` n'atteint que 4,3:1 en texte sur blanc. En texte
on utilise `#C42818` (5,4:1) en mode clair et `#FF6B5B` (5:1) en mode sombre. Pas de texte rouge
sur le bleu : le rouge y sert de fond, comme le mot « TRACK » du logo.

- **Mode sombre** dès le départ (les soirs de meeting) : fond nuit `#052B5C`.
- **Typo** : titre sportif en capitales, Bricolage Grotesque (variable, hébergée dans le projet),
  Inter pour le texte. Chiffres tabulaires pour les chronos et classements.
- **Formes** : coins très arrondis, ombres douces, motif de couloirs de piste sur le dégradé bleu.
- **Fond piste** (accueil, v0.10, #346) : un virage de piste en traits fins, 8 couloirs numérotés
  (`TrackBackground`), décoratif (`aria-hidden`), sans animation ; opacité 0,14 en sombre, 0,08 en
  clair. Les cartes posées dessus gardent un fond presque opaque pour la lisibilité.
- **Titre** : « FRENCH TRACK » en blanc, « PRONO » dans une étiquette rouge légèrement inclinée,
  en écho au logo.
- **Mascotte** (idée) : un petit sprinter-emoji qui réagit (🏃 😎 🤯 🔥).

## Écrans de la V1

| Écran | Contenu clé |
|---|---|
| Accueil (joueur connecté, #526) | Salutation ; carte « Ta prochaine action » (finale à pronostiquer la plus proche du verrouillage, sinon prochaine compétition) ; dessous, « Complète ton profil » tant que le profil n'a ni club ni discipline (#540 : recherche de club, six familles en boutons à bascule, « Préciser les épreuves », × « Plus tard » pour 30 jours ; bandeau vert « Ton premier podium est posé ! » au-dessus après le premier prono) ; « Comment ça marche » avant le premier prono (refermable) ; ma ligue (place, écart, trois lignes) ou l'invitation à en créer une ; dernier résultat noté ; French Track Manager ; bloc FrenchTrack (podcast, réseaux). Un bloc vide ne s'affiche pas |
| Compétitions (onglet, #546, #659) | Libellé « Compétition » puis bouton-carte (pavé date, nom en `h1`, ville, dates, nombre d'épreuves, « Changer ») qui ouvre la feuille « Choisir une compétition » (recherche, Toutes / Internationales / France, « Dans mes ligues » puis par mois, puis « Terminées ») ; barre des jours (`?jour=`, « AUJ. », pastille pour un jour fini et pour aujourd'hui) ; bandeau d'une ligne (à pronostiquer ce jour, podiums posés, points) ; sélecteur segmenté « À faire » (par défaut s'il reste à faire), « Posés », « Terminées » (si le jour a des épreuves finies), « Toutes » ; sessions Matin / Après-midi / Soir. Sans programme : « Le programme n'est pas encore publié », jours avant le début, « Me prévenir à la publication ». Un visiteur n'a ni le bandeau ni les filtres « À faire » et « Posés » |
| Épreuve | Liste de départ, **podium à composer** (glisser-déposer ou taps), joker, verrou |
| Résultat d'épreuve | Podium officiel vs mon prono, points gagnés, confettis si podium parfait |
| Ligue | Classement, derniers pronos révélés, réactions emoji ; tant que le joueur y est seul, **InviteBanner** à la place du classement |
| Accueil Manager (onglet, #606) | Titre et accroche ; bloc bleu nuit « Ma saison » (ligue et joueurs, journée N sur M, place, points V · N · D, différence, prochaine confrontation avec les dossards, l'action du moment : mercato, « Aligner mon équipe · verrouillage dans 2 j », résultats ou fin de saison) ; raccourcis (Mon équipe, Classement, Calendrier, Mes derniers points) ; « Le déroulé de la saison » en sept étapes, faites cochées, en cours en rouge ; puis mes ligues Manager et les ligues publiques. Sans ligue : la présentation (#618), puis le déroulé et « Créer ou rejoindre une ligue » |
| Ligues (#662) | « Créer une ligue » et « J'ai un code », puis deux onglets **Mes ligues · N** / **Découvrir** (`?onglet=decouvrir`). Mes ligues : cartes résumées (**LeagueCard**). Découvrir : tant que le joueur n'en est pas membre, le bloc bleu nuit de la Ligue FrenchTrack (**OfficialLeague**, #553) ; puis les ligues publiques (**DiscoverLeagues**) : recherche par nom, puces de famille (Toutes + celles présentes), tri (places restantes par défaut, plus de joueurs, plus récentes), une **PublicLeagueRow** par ligue. Une fois membre, la ligue officielle rejoint Mes ligues avec le badge « Officielle » |
| Classement général | Top de la communauté, ma progression |
| Profil | Dossard (grand format, avec le pseudo), club ; saison (tuiles, courbe), derniers pronos, badges et leur progression, classement des clubs, carte à partager ; palmarès Manager (une ligne par saison finie, en or si champion, #434) |
| Back-office (toi) | Tableau de bord (choses à faire, préparation), compétitions (filtres portée, lieu, niveau, statut, #647) et épreuves, une feuille de résultats par épreuve qui calcule tout (collage du tableau World Athletics, #665, #666), listes des clubs, joueurs et ligues |

## Composants clés

- **PodiumPicker** : trois marches (or, argent, bronze) au-dessus de la liste de départ ; on
  touche les athlètes dans l'ordre 1er, 2e, 3e, un appui sur un athlète placé le retire, un appui
  sur une marche la sélectionne (pas de glisser-déposer). Sert aussi à la saisie des résultats.
  Sélection lisible (#698) : la marche à remplir a un anneau plein de 3 px en `--accent-text`
  (≥ 3:1 sur la page et la carte, clair et sombre) ; un athlète placé a une bordure de 2 px
  `--accent-text`, un fond `--primary-soft` et son numéro de marche. Le focus clavier est un
  contour `--ring` (bleu en clair, or en sombre), distinct de la sélection.
- **CountdownBadge** : « Verrouillage dans 12 min », neutre, puis orange dès 1 h et rouge dès
  10 min (jetons `--countdown-*` dans `globals.css`, contrastes AA), « 🔒 Verrouillé » ensuite ;
  rien ne clignote.
- **EventCard** (#546) : l'heure de Paris, le nom avec le genre (« 100 m femmes »), une ligne
  dessous, un statut à droite. À venir : « Verrouille dans … » (`LockLine`, rouge dès 1 h ; au-delà
  de 24 h, « Verrouille le <jour> à <heure> »), « + Prono » ou « ✓ Posé » avec « modifiable ».
  Terminée : fond atténué, mon résultat (« 2 athlètes bien placées », « Podium parfait ! »,
  « Pas de prono ») et mes points en pastille verte, « — » sans prono. Le lien est nommé par
  l'épreuve puis par son statut (#517).
- **DayProgress** (#659) : une ligne, les épreuves à pronostiquer du jour affiché, les podiums
  posés sur toute la compétition et les points gagnés.
- **Filtres en pastilles** (`EventFilters`) : une pastille par filtre avec son nombre, la
  pastille active pleine ; elles défilent à l'horizontale sur mobile.
- **AthleteChip** : drapeau, nom, record de saison.
- **PointsToast** : « +9 pts, vainqueur du 100 m trouvé ! » avec petite animation.
- **Bib** (dossard, #537) : l'avatar du joueur, un numéro (0 à 999) et une couleur parmi six,
  fixes dans les deux thèmes : bleu `#084595` (texte blanc), rouge `#E03020` (texte blanc), or
  `#FFC857` (texte nuit), vert `#2BB673` (texte nuit), blanc (texte nuit, bordure), nuit
  `#052B5C` (texte or, bordure or). Grand format (profil, choix) : coins arrondis, quatre
  épingles, « FRENCH TRACK », le numéro en gros, le pseudo dessous. Petit format (classements,
  en-tête, ligues, réactions) : pastille avec le numéro seul. Couleurs dans `BIB_PALETTE`
  (`src/components/profile/bib.tsx`), reprises par la carte de saison.
- **Leaderboard** et **RankingRow** (#551, #661) : place, dossard, pseudo, ▲ n vert / ▼ n rouge
  (« = » sinon ; lu « gagne n places »), points ; dans l'onglet Classement, l'évolution compare au
  classement d'avant la dernière compétition terminée de la portée, ailleurs à la veille ; ex æquo signalés, ma ligne surlignée (cible `#moi` du lien « Autour de
  moi »), raison du départage sous le pseudo, pas de badge de série. Un classement long montre les
  10 premiers, « ··· », puis le joueur et deux voisins de chaque côté.
- **Podium** (#551) : les trois premiers sur des marches 2-1-3 (dégradés or, argent, bronze),
  dossard, pseudo et points ; lu dans l'ordre 1-2-3 ; absent tant que personne n'a de points.
- **Onglet Classement** (#551, #661) : sélecteur segmenté (onglets) « Ma ligue » (ouvert par
  défaut), « Ce soir », « Général » ; dessous, un seul bouton de portée (**ScopeButton**) :
  « Ligue · <nom> · N joueurs » ou « Portée · Toute la saison 2026-27 » (ou la compétition), avec
  « Changer », qui ouvre la feuille « Choisir le classement » (**ScopeSheet**, même feuille du bas
  que celle des Compétitions, `BottomSheet`) : onglet « Saison ou compétition » (recherche,
  « Toute la saison » en tête, « En cours » puis « Terminées », jamais les compétitions à venir) et
  onglet « Mes ligues » (ma place, nombre de joueurs et de compétitions, coche sur la ligue
  affichée, « Créer ou rejoindre une ligue »). « Ce soir » affiche une ligne « Points des finales
  de ce soir · <compétition>, <jour> ». En tête de liste, la carte **MyPlaceCard** « Ta place »
  (rang, points, évolution depuis la dernière compétition, « 18 pts derrière <pseudo> (3e) », et
  « Top 18 % » en Général), masquée pour un visiteur ou un joueur sans points ;
  une barre fixe en bas « Tu es 3e · 52 pts · Autour de moi » ; avant la première compétition, un
  bandeau bleu « Le classement démarre » remplace le classement vide. Le jour de compétition va de
  6 h à 6 h, heure de Paris : une finale courue à 2 h du matin compte pour « Ce soir ».
  Un visiteur voit « Général » seul, sans barre fixe, avec « Se connecter » (#573).
- **LeagueCard** (#552, résumée en #662) : une de mes ligues ; nom sur deux lignes au plus,
  étiquette « Privée », « Publique » ou « Officielle », badge de familles (#613), « 12 compétitions ·
  déc. 2026 → avr. 2027 » (jamais leurs noms, qui restent sur la page de la ligue), « Prochaine :
  <compétition>, <date> » ; à droite ma place en gros, « sur N » et ▲/▼ depuis la veille, « Pas
  encore de points » sans points.
- **PublicLeagueRow** (#662) : une ligue publique de « Découvrir » ; nom, badge de familles,
  « 12/200 joueurs · 3 compétitions · période », barre de remplissage, « Rejoindre » et « Signaler ».
- **LeagueFamilyPicker** (#613) : « Épreuves qui comptent » à la création d'une ligue ; deux
  choix, « Toutes les épreuves » (par défaut) ou « Certaines familles » avec huit puces à cocher
  (plusieurs à la fois) ; « Créer » reste inactif tant qu'aucune puce n'est cochée.
- **FamilyBadge** (#613) : « Sprint · Haies », pastille bleu doux sur la carte et la page d'une
  ligue limitée ; rien pour une ligue sur toutes les épreuves.
- **SeasonCompetitionPicker** (#663, Manager ; ligue de pronos depuis #721, dès 1 compétition, sous le nom et les familles de la ligue) : sélections rapides avec leur nombre, recherche,
  filtres Portée, Lieu, Niveau, liste rangée par mois avec « Tout cocher », barre fixe « 15
  compétitions cochées » ; vide : « Aucune compétition ne correspond à ces filtres » et
  « Réinitialiser les filtres ».
- **InviteBanner** (#552) : dans une ligue où le joueur est seul, fond bleu doux, « Tu es seul
  pour l'instant », un grand bouton « Inviter mes amis » (partage natif, sinon lien copié) et le
  code lisible dessous pour le dire à voix haute.
- **Carte « Ma saison »** (`/profil/carte`) : image verticale 1080×1920 prête pour les stories,
  partagée par le partage natif ou téléchargée ; « Mon podium du 100 m » viendra plus tard.
- **Liste du back-office** (clubs, joueurs, ligues) : recherche, puces de filtre avec leur
  nombre, tableau triable, actions groupées sur la sélection, panneau de détail ; même gabarit
  pour les trois listes.
- **Navigation** (#471) : sur mobile, barre du bas « Accueil, Compétitions, Classement, Ligues,
  Manager » ; sur desktop, menu du haut « Accueil, Compétitions, Classement, Ma ligue, Manager ». Le
  profil s'ouvre depuis le pseudo et le dossard de l'en-tête.
- **Menu admin** : entrées groupées par rubrique, le tableau de bord en tête.
- **BadgeGrid** : badges gagnés en couleur, les autres grisés avec leur règle ; dessous, le
  prochain badge et ce qu'il reste à faire pour l'obtenir.
- **CompetitionChips** : puces d'une compétition à l'autre (classement, historique des pronos).
- **AthleteCard** (Manager, #426) : carte or d'un athlète de l'équipe ; code de famille, prix
  payé, initiales (jamais de photo), prénom et initiale du nom ; états « Sélectionné » et
  « Absent·e » ; format compact sur une place du stade. Dans une confrontation (#605) : bonus
  (« +20 ») en haut à droite et points en bas à la place du prix, bleu clair (`--duel-blue-*`)
  pour l'adversaire ; un athlète à 0 a un cadre rouge en pointillés.
- **DuelStadium** (Manager, #605) : un seul stade coupé par une ligne blanche, les titulaires de
  l'adversaire en haut (cartes bleues), ceux du joueur en bas (cartes or), sur les places de
  l'alignement ; « … n'a pas validé d'alignement : 0 point » à la place d'une moitié vide.
- **LineupBoard** (Manager, #427) : un stade (piste `--track` autour d'une pelouse `--field`)
  porte les places des titulaires, une par carte, chacune d'une famille ou « Libre » (règles de la
  ligue) ; dessous, les remplaçants. Glisser-déposer à la souris ; au toucher, une carte puis une
  place (les places compatibles s'allument) ; toucher une carte du stade la renvoie sur le banc ;
  tout est bouton, donc au clavier aussi. Compteur « N/M places », barre du bas « À remplir : … »
  et « Valider mon alignement ». Une place que l'équipe ne peut pas remplir reste grise
  (« Personne ») et n'empêche pas de valider. Bandeaux « Alignement validé » et « Verrouillé ».
- **ManagerTutorial** (Manager, #616) : sept étapes plein écran sur le bleu nuit, dans les deux
  thèmes ; une idée par étape, avec un dessin en formes simples (dossards, cartes, stade, barres,
  trophée ; jamais de photo) et les chiffres des règles ; « Précédent » / « Suivant » (flèches du
  clavier aussi), « Passer » à toute étape, « C'est parti » à la dernière. S'ouvre seul à la
  première visite de `/manager` (mémorisé sur l'appareil), puis par « Comment ça marche ? ».

- **ManagerHome** (Manager, #606) : « Ma saison » sur le bleu nuit dans les deux thèmes, raccourcis
  et « Le déroulé de la saison » ; l'étape en cours vient de `currentSeasonStep`
  (`src/domain/manager-home.ts`), tirée de l'état de la ligue, du mercato, du prochain alignement et
  de la saison. Elle revient à « Alignement » à chaque journée.

## Ton éditorial

Court, complice, sportif, un peu moqueur. Exemples :
- État vide : « Pas encore de prono ? Même Duplantis commence à 5 m. »
- Raté total : « 0 point. Le chrono ne ment pas. »
- Coup de flair : « Tu l'avais vu venir quand personne ne regardait. 🎯 »

Tout le texte en français, tutoiement.

## Accessibilité et qualité

Contrastes AA minimum, cibles tactiles de 44 px, glisser-déposer toujours doublé d'une
alternative au tap, animations réduites si `prefers-reduced-motion`.
