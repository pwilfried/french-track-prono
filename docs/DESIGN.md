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
  Inter pour le texte. Chiffres tabulaires pour les chronos et classements. La police à chasse
  fixe est réservée aux chiffres (chronos, marques, scores, comptes à rebours) ; les sous-titres
  de page et toute phrase restent dans la police du texte (#706).
- **Points** (#706) : une seule écriture, par les fonctions de `messages.format`
  (`src/app/messages.fr.ts`). « 1 pt / 12 pts » dans les endroits serrés (pastilles, lignes,
  barre « Tu es 1er · 0 pt »), « 1 point / 12 points » dans les phrases (« À 3 points de… »),
  « +9 pts » pour des points gagnés. Jamais de chiffre seul sans unité, sauf dans la colonne des
  points du classement, sous son en-tête « Pts ». Un joueur sans points le voit une seule fois par
  écran : la ligne du classement dit « 0 », sans « Pas encore de points » en plus ; « Mes points »
  vide n'affiche que son message.
- **Unités** (#939) : un nombre et son unité ne se coupent jamais (« 4x100 m », « 12 pts »,
  « 7,05 m ») : espace insécable posé par `keepUnits` (`src/domain/event-label.ts`).
- **Sélecteurs** (#939) : un sélecteur segmenté à une seule option n'est pas affiché (« Général »
  seul pour un visiteur, « Toutes » seul).
- **Formes** : coins très arrondis, ombres douces, motif de couloirs de piste sur le dégradé bleu.
- **Fond piste** (accueil, v0.10, #346) : un virage de piste en traits fins, 8 couloirs numérotés
  (`TrackBackground`), décoratif (`aria-hidden`), sans animation ; opacité 0,14 en sombre, 0,08 en
  clair ; les numéros des couloirs sont encore estompés (opacité 0,4 de plus, #939), car ils passent
  sous le texte. Les cartes posées dessus gardent un fond presque opaque pour la lisibilité.
- **Titre** : « FRENCH TRACK » en blanc, « PRONO » dans une étiquette rouge légèrement inclinée,
  en écho au logo.
- **Icône de l'appli** (décision du propriétaire du 14 nov. 2026, #767) : sur l'écran d'accueil
  du téléphone, le lièvre (blanc, contour nuit `#052B5C`, bandeau rouge `#E03020`) au-dessus de
  « FRENCH » en bleu et « TRACK » en rouge, sur le fond crème `#fdfbf5` ; nom sous l'icône
  « FrenchTrack » (`short_name` du manifeste, titre Apple), nom complet « French Track Prono ».
  L'icône maskable garde le dessin dans le cercle central de 80 %. L'onglet du navigateur
  (favicon 32 et 16 px, `favicon.ico`) montre la tête du lièvre seule, sans texte, en traits plus
  épais. Le lièvre est un dessin original, une seule source : `src/components/brand/hare-art.ts`,
  dessiné par le composant `Hare` (story « Brand/Hare », grand et petit format, tête seule). Les
  PNG de `public/icons/` et `public/favicon.ico` se régénèrent par
  `node scripts/app-icons.mjs` (lièvre + `public/brand/frenchtrack-light.png`). L'en-tête et la
  page d'accueil gardent le logo FrenchTrack.
- **Mascotte** (idée) : un petit sprinter-emoji qui réagit (🏃 😎 🤯 🔥).

## Écrans de la V1

| Écran | Contenu clé |
|---|---|
| Accueil (joueur connecté, #526) | Salutation ; carte « Ta prochaine action » (finale à pronostiquer la plus proche du verrouillage, sinon prochaine compétition ; premier bloc, #932) ; juste dessous, carte « Le saviez-vous ? » (#766 : un fait, son étiquette, « Un autre », × jusqu'au lendemain ; absente si la banque est vide ou la carte masquée) ; dessous, « Complète ton profil » tant que le profil n'a ni club ni discipline (#540, #801 : une carte compacte, une ligne et « Compléter », qui ouvre par-dessus l'accueil une feuille en deux étapes, #889 : « Mon club », la recherche de club et le club imprimé en direct sur le dossard du joueur, puis « Mes épreuves », six animaux de la bande à allumer d'un toucher (nom et famille écrits dessous, coche quand allumé) et « Préciser les épreuves » ; « Retour » et la fermeture gardent la saisie ; « Plus tard » sur les deux étapes ; la confirmation s'affiche dans la feuille ; × « Plus tard » pour 30 jours ; bandeau vert « Ton premier podium est posé ! » au-dessus après le premier prono) ; « Comment ça marche » avant le premier prono (refermable) ; ma ligue (place, écart, trois lignes) ou l'invitation à en créer une ; dernier résultat noté ; « Dans ma communauté » (#673 : la dernière annonce FrenchTrack hors épisode, le dernier défi « Battez FrenchTrack » calculé (#877 : épreuve, part des joueurs qui l'ont battu, mon verdict ; la carte mène à l'épreuve), le sondage ouvert, les trois derniers moments de mes ligues avec le nom de la ligue, « Tout voir » vers `/communaute`) ; French Track Manager ; bloc FrenchTrack (podcast avec le dernier épisode annoncé par l'admin, #896, réseaux). Un bloc vide ne s'affiche pas |
| Compétitions (onglet, #546, #659) | Libellé « Compétition » puis bouton-carte (pavé date, nom en `h1`, ville, dates, nombre d'épreuves, « Changer ») qui ouvre la feuille « Choisir une compétition » (recherche, Toutes / Internationales / France, « Dans mes ligues » puis par mois, puis « Terminées ») ; barre des jours (`?jour=`, « AUJ. », pastille pour un jour fini et pour aujourd'hui) ; bandeau d'une ligne (à pronostiquer ce jour, podiums posés, points) ; sélecteur segmenté « À faire » (par défaut s'il reste à faire), « Posés », « Terminées » (si le jour a des épreuves finies), « Toutes » ; sessions Matin / Après-midi / Soir. Sans programme : « Le programme n'est pas encore publié », jours avant le début, « Me prévenir à la publication ». Un visiteur n'a ni le bandeau ni les filtres « À faire » et « Posés » |
| Épreuve | Liste de départ (par meilleure marque de la saison, et c'est écrit, #939), **podium à composer** (glisser-déposer ou taps), joker, verrou ; sur un défi, la carte « Battez FrenchTrack » (#674 : « posé, dévoilé au verrouillage », puis les deux podiums, le verdict, la part des joueurs qui l'ont battu, « Partager ») |
| Résultat d'épreuve | Podium officiel vs mon prono, points gagnés, confettis si podium parfait |
| Ligue | Onglets **Classement** · **Membres** · **Fil** (#671 : moments groupés « Ce soir · <compétition> », « Hier », puis par jour ; sous chaque moment, quatre emojis, cinq messages prédéfinis et « Signaler », #672 ; même onglet « Fil » sur une ligue Manager, #875) ; derniers pronos révélés, réactions emoji ; tant que le joueur y est seul, **InviteBanner** à la place du classement |
| Accueil Manager (onglet, #606, #774) | Titre et accroche ; « Créer une ligue Manager » et « Rejoindre avec un code » côte à côte en haut ; « Mes ligues Manager », une carte compacte par ligue (nom, phase : mercato · tour N, saison · journée N sur M ou terminée, ma place, la prochaine échéance : fin du tour ou verrou d'alignement, et une pastille rouge « Enchères à faire » ou « Alignement à valider ») ; puis « Comment ça marche ? » et les ligues publiques. Une carte ouvre la page de la ligue, même avec une seule ligue. Sans ligue : la présentation en trois écrans par-dessus à la première visite (#802), puis le mode en une ligne, « Créer ou rejoindre une ligue » et « Le déroulé de la saison » |
| Page d'une ligue Manager (#419, #774) | En-tête : « ‹ French Track Manager » (retour à la liste), nom, phase · participants · type ; bloc bleu nuit « Ma saison » (phase, place, points V · N · D, différence, prochaine confrontation avec les dossards, l'action du moment) ; état du mercato ; liens vers ce qu'elle contient (catalogue, Mon équipe, Mon alignement, La journée, Classement, Mes derniers points) ; calendrier, participants, règles |
| Ligues (#662) | « Créer une ligue » et « J'ai un code », puis deux onglets **Mes ligues · N** / **Découvrir** (`?onglet=decouvrir`). Mes ligues : cartes résumées (**LeagueCard**). Découvrir : tant que le joueur n'en est pas membre, le bloc bleu nuit de la Ligue FrenchTrack (**OfficialLeague**, #553) ; puis les ligues publiques (**DiscoverLeagues**) : recherche par nom, puces de famille (Toutes + celles présentes), tri (places restantes par défaut, plus de joueurs, plus récentes), une **PublicLeagueRow** par ligue. Une fois membre, la ligue officielle rejoint Mes ligues avec le badge « Officielle » |
| Classement général | Top de la communauté, ma progression ; lien vers `/classement/frenchtrack` (#674 : « Qui bat FrenchTrack le plus souvent ? », victoires puis points, pseudo et dossard) |
| Communauté (`/communaute`, #673) | Tout le bloc « Dans ma communauté » : annonces, défis « Battez FrenchTrack » calculés, sondages (vote puis parts en pourcentages), moments de mes ligues avec le nom de la ligue |
| Profil | Célébration du lièvre (niveaux gagnés), changement d'animal ; dossard (grand format, avec le pseudo), club ; avant la première épreuve calculée, un seul encart à la place des stats et de la grille de badges (**ProfileStart**, #799 : « Fais ton premier prono… » ou les pronos en attente, le prochain badge, un bouton vers la prochaine finale ouverte, sinon vers les compétitions) ; ma bande (mon animal) ; vitrine des trophées (une étagère par saison) ; saison (tuiles, courbe), derniers pronos, badges et leur progression, classement des clubs, carte à partager ; « Mes rappels » (`/profil/rappels`, #681) ; palmarès Manager (une ligne par saison finie, en or si champion, #434) |
| Back-office (toi) | Tableau de bord (choses à faire, préparation), compétitions (filtres portée, lieu, niveau, statut, #647) et épreuves, une feuille de résultats par épreuve qui calcule tout (collage du tableau World Athletics, #665, #666), listes des clubs, joueurs et ligues (« Signalements du fil » en tête des ligues : masquer ou classer, #672), « Communauté » (annonces et sondages, #673), « Le saviez-vous ? » (faits et carte, #766), défi FrenchTrack d'une épreuve (#674) |

## Composants clés

- **PodiumPicker** : trois marches (or, argent, bronze) au-dessus de la liste de départ ; on
  touche les athlètes dans l'ordre 1er, 2e, 3e, un appui sur un athlète placé le retire, un appui
  sur une marche la sélectionne (pas de glisser-déposer). Sert aussi à la saisie des résultats.
  Sélection lisible (#698) : la marche à remplir a un anneau plein de 3 px en `--accent-text`
  (≥ 3:1 sur la page et la carte, clair et sombre) ; un athlète placé a une bordure de 2 px
  `--accent-text`, un fond `--primary-soft` et son numéro de marche. Le focus clavier est un
  contour `--ring` (bleu en clair, or en sombre), distinct de la sélection. « Règles » ouvre les
  règles dans une feuille du bas par-dessus l'épreuve (#703), avec « Toutes les règles » vers
  `/regles` ; le lien reste une page sans JavaScript. Le podium en cours est gardé dans l'onglet
  (`sessionStorage`, #699) : après la fiche d'un athlète, « Retour » ramène au podium tel qu'il
  était ; il est oublié une fois enregistré ou l'épreuve verrouillée.
- **Bouton « Enregistrer mon podium »** (#700) : inactif tant que le podium n'est pas complet ;
  pendant l'envoi, inactif avec une roue (masquée si `prefers-reduced-motion`) et
  « Enregistrement… » ; une fois enregistré, fond `--success-soft`, texte `--success-ink`, anneau
  vert et « ✓ Podium enregistré », jusqu'au prochain changement du podium, des perfs ou du joker.
- **Notification en haut de l'écran** (#700) : après un enregistrement, une pastille fixe en haut,
  visible quelle que soit la position dans la page (sous la zone sûre du téléphone), disparaît
  après 5 s. Vert doux « ✓ Podium enregistré » (`role="status"`) ou rouge plein avec le message
  d'erreur, hors ligne compris (`role="alert"`). Rendue hors de `main` : l'erreur du podium reste
  la seule alerte du contenu.
- **Boutons d'envoi** (`SubmitButton`, #712) : tout formulaire joueur se verrouille pendant
  l'envoi ; le bouton touché se désactive et dit ce qu'il fait (« Enregistrement en cours… »,
  « Déconnexion en cours… »), les autres sont seulement inactifs ; un double tap n'envoie qu'une
  fois. Un formulaire qui mène à une autre page reste en attente jusqu'à son chargement.
- **Boutons** (`buttonVariants`, #701) : un libellé long passe à la ligne, centré, dans un bouton
  qui grandit (44 px au moins) ; jamais de texte qui déborde de 320 à 390 px. Deux boutons aux
  libellés longs s'empilent plutôt que de se serrer côte à côte.
- **CountdownBadge** : « Verrouillage dans 12 min », neutre, puis orange dès 1 h et rouge dès
  10 min (jetons `--countdown-*` dans `globals.css`, contrastes AA), « 🔒 Verrouillé » ensuite ;
  rien ne clignote.
- **EventCard** (#546, #800) : l'heure de Paris au-dessus de l'animal de la famille (petit,
  décoratif ; le lièvre pour un relais ou une famille inconnue, `animalOrHare`, le même en tête de
  la page de l'épreuve), le nom avec le genre (« 100 m femmes »), une ligne dessous, un statut à
  droite. À venir sans prono : le temps restant (`LockLine`, rouge dès 1 h ; au-delà de 24 h,
  « Verrouille le <jour> à <heure> ») et « + Prono » ; avec prono : mon podium en noms courts
  et « modifiable », « ✓ Posé » à droite. Terminée : fond atténué, le vainqueur, mon résultat
  (« 2 athlètes bien placées », « Podium parfait ! ») et mes points en pastille verte ; sans prono, « Pas joué » et rien à droite, jamais de tiret seul
  (#707). Le lien est nommé par l'épreuve puis par son statut (#517). Dates d'une compétition :
  mois et année écrits une fois (« 11–13 sept. 2026 », « 30 sept. – 2 oct. 2026 »).
- **DayProgress** (#659) : une ligne, les épreuves à pronostiquer du jour affiché, les podiums
  posés sur toute la compétition et les points gagnés.
- **Sélecteurs segmentés** (#708) : vues (`ViewTabs`), filtres de l'onglet Compétitions
  (`EventFilters`, un segment par filtre avec son nombre) et portées des feuilles du bas partagent
  la même piste (`segmentedTrack`) et la même surface (`segmentSurface`,
  `src/components/ui/view-tabs.tsx`) : le segment choisi est surélevé et cerné d'un anneau
  `--border`, lisible en clair comme en sombre ; les autres sont atténués.
- **AthleteChip** : drapeau, nom, record de saison.
- **AthleteSheet** (fiche athlète, #679) : initiales dans un rond (jamais de photo), pays,
  disciplines ; chiffres clés (PB, SB de la discipline principale, prix Manager) ; un bloc par
  discipline avec PB et SB de la saison, lieu et date quand on les connaît ; une marque non
  vérifiée porte un « ? » (lu « marque à vérifier »). Records seulement, pas de résultats.
- **ConsensusBlock** (#680) : « Ce qu'ont pronostiqué les joueurs », au-dessus des podiums révélés
  et filtré par les mêmes onglets ; par place, les athlètes choisis et leur pourcentage, mon choix
  surligné ; la part des joueurs qui ont mon podium, mon choix le plus original et, après le
  résultat, la part de podiums parfaits.
- **PointsToast** : « +9 pts, vainqueur du 100 m trouvé ! » avec petite animation.
- **Bib** (dossard, #537) : l'avatar du joueur, un numéro (0 à 999) et une couleur parmi six,
  fixes dans les deux thèmes : bleu `#084595` (texte blanc), rouge `#E03020` (texte blanc), or
  `#FFC857` (texte nuit), vert `#2BB673` (texte nuit), blanc (texte nuit, bordure), nuit
  `#052B5C` (texte or, bordure or). Grand format (profil, choix) : coins arrondis, quatre
  épingles, « FRENCH TRACK », le numéro en gros, le pseudo dessous. Petit format (classements,
  en-tête, ligues, réactions) : pastille avec le numéro seul. Couleurs dans `BIB_PALETTE`
  (`src/components/profile/bib.tsx`).
- **La bande** (#768) : un composant `Animal` (`src/components/band/animal.tsx`) pour le lièvre,
  mascotte, et les six animaux de famille (guépard, impala, kangourou, chat, ours, renard), plus
  le « ? » gris de ce qui reste à gagner ; un médaillon rond aux couleurs fixes dans les deux
  thèmes. Les dessins vivent seuls dans `animal-drawings.tsx` : les dessins définitifs y
  remplacent les croquis sans toucher au code. L'animal du joueur est la famille où il a marqué le
  plus de points de la saison (égalité : les points les plus récents, `src/domain/band.ts`) ; les
  relais ne comptent pour aucun animal. Un changement s'annonce une fois en haut du profil
  (« Tu es passé Guépard ! »), retenu sur l'appareil.
- **Carte de saison** (image à partager, `/profil/carte`, #900) : 1080 × 1920, sans dossard, aux
  couleurs de l'animal du joueur (le lièvre, mascotte, tant qu'il n'en a pas) ; de haut en bas :
  marque et saison, l'animal en grand dans son médaillon cerclé de blanc avec sa famille
  (« GUÉPARD · SPRINT »), le pseudo, les points en très grand et le rang, le meilleur coup, la
  phrase d'appel, une bande de piste. Fonds dans `SEASON_CARD_PALETTE`
  (`src/components/band/season-card-palette.ts`) : texte bleu `#084595` sur les fonds clairs,
  crème `#F3E3C7` sur le brun de l'ours, contraste AA testé pour chaque animal.
- **Dossard** (badge, #768) : carte blanche à deux épingles, bande du niveau en haut (dégradés or,
  argent, bronze), l'animal de la discipline en grand, le numéro et le nom en bas ; grisé avec le
  « ? » tant qu'il est à débloquer.
- **Statuette** (trophée, #768, dessinée en SVG depuis #856) : une forme coulée en or, argent ou
  bronze sur un socle en bois et sa plaque gravée (ligue, saison, place). La forme est l'animal de
  la ligue (le lièvre pour une ligue Manager sans animal), une couronne de laurier pour le
  classement général (« 1er », « Top 3 » ou « Top 10 » au centre), ou le dessin de l'exploit :
  chrono (Chrono figé), record (Record de ligue), témoin (Témoin d'or), toujours en or. Aucun
  emoji. Une place vide de la vitrine montre la même forme en gris et ce qu'il faut pour la
  gagner.
- **TrophyShowcase** (vitrine, #822) : une étagère par saison, la plus récente en haut, une
  statuette par trophée avec son nom (« Guépard d'or », « Chrono figé ») et où il a été gagné ;
  vide, elle dit comment gagner le premier.
- **Leaderboard** et **RankingRow** (#551, #661) : place, dossard, pseudo, ▲ n vert / ▼ n rouge
  (« = » sinon ; lu « gagne n places »), points (chiffre seul sous l'en-tête « Pts », lu « 12 points ») ; dans l'onglet Classement, l'évolution compare au
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
  une barre fixe en bas **MyRankBar** « Tu es 3e · 52 pts », avec « Autour de moi » seulement
  quand ma ligne est hors de l'écran (#710) ; seul dans sa ligue, le joueur voit le bandeau
  « Tu es seul pour l'instant » (inviter ses amis) au lieu d'un classement à une ligne ; avant la
  première compétition, un
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
  filtres Portée, Lieu, Niveau, liste rangée par mois avec « Tout cocher », puis la barre « 15
  compétitions cochées » et le bouton, à la fin de la liste, jamais par-dessus (#980) ; vide : « Aucune compétition ne correspond à ces filtres » et
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
- **BadgeGrid** : les 6 badges de jeu, puis les 7 badges de famille ; un badge gagné porte une
  médaille (bronze, argent, or) derrière son emoji et son niveau en étiquette, les autres sont
  grisés ; chacun dit ce qu'il compte et le seuil suivant (« 2 / 3 pour le bronze »). Dessous, le
  prochain badge et ce qu'il reste (« encore 10 pts » pour une famille). Chaque badge est un
  **Dossard** (#838) portant l'animal de sa famille, le lièvre pour un badge de jeu.
- **BadgeCelebration** (#821) : en haut du profil, le lièvre (qui sautille, sauf mouvement
  réduit) annonce les niveaux gagnés depuis la dernière visite, une seule fois ; « Super ! » ferme.
- **CompetitionChips** : puces d'une compétition à l'autre (classement, historique des pronos).
- **AthleteCard** (Manager, #426) : carte or d'un athlète de l'équipe ; code de famille, prix
  payé, initiales (jamais de photo), prénom et initiale du nom ; état « Absent·e » sur le banc de
  l'alignement. Sur le stade (#775), un athlète est une place (`PlacedSpot`), comme sur la maquette
  validée « Confrontation stade contre stade » : les courses sur fond or (`--spot-race`), les
  concours sur fond blanc (`--spot-field`), dans les deux thèmes ; la discipline en capitales
  (bleu nuit pour une course, rouge `--spot-field-label` pour un concours), le prénom et l'initiale
  du nom, puis dans une confrontation les points (chasse fixe) ou « à venir ».
- **DuelStadium** (Manager, #605, #775) : stade contre stade. En haut « Stade de <pseudo> » et son
  score (bleu nuit), son stade ; une ligne fine coupée par une pastille bleu nuit « 37 - 41 »
  (chiffres or, chasse fixe) ; le stade du joueur, puis « Mon stade » et son score (rouge quand il
  mène) ; la légende « Mêmes places que l'alignement. ▲ : duel gagné à cette épreuve. ». Chaque
  titulaire est à la même place dans les deux stades ; « ▲ » après les points et un contour bleu
  nuit épais pour la carte qui bat celle de la même place en face. « … n'a pas validé d'alignement :
  0 point » à la place d'un stade vide. En tête de page : « ‹ <ligue> », « Journée N · en direct »
  (ou « terminée ») et « N épreuves à venir ».
- **LineupBoard** (Manager, #427, #775) : le stade vu du dessus (`StadiumMap` : un ovale, piste
  `--track` avec un fin liseré clair autour d'une pelouse `--field`), une place par titulaire à son
  endroit, les mêmes que dans une confrontation (`stadium-spots.ts`) : sur la piste, sprint et haies
  en bas (« 100 m ») puis à gauche (« 400 m »), demi-fond et fond à droite (« 1500 m »), une
  huitième place en haut ; sur la pelouse, sauts en haut (« hauteur ») puis à gauche
  (« longueur »), lancers à droite (« javelot ») puis au centre (« poids »), combinées au centre ;
  les places « Libre » prennent les endroits restants dans cet ordre. Quatre cartes tiennent côte à
  côte sur la ligne du milieu, sans chevauchement et dans l'ovale de 320 à 390 px (#929). Une place montre l'athlète ou un
  « + » en pointillés. Toucher une
  place ouvre une feuille avec les athlètes de l'équipe : ceux qui ne vont pas sont grisés avec la
  raison (absent·e, autre famille) ; en choisir un déjà placé ailleurs échange les deux s'il le
  peut ; « Retirer de cette place ». Dessous, les remplaçants. Compteur « N/M places » ; juste
  sous le stade, jamais par-dessus (#929), la barre « À remplir : … » et « Valider mon alignement » (« Validation en cours… »). Une place que
  l'équipe ne peut pas remplir reste grise (« Personne ») et n'empêche pas de valider ; la barre
  dit combien restent vides et pourquoi (#839). Le compteur et la barre ne comptent que les places
  tenues par un athlète engagé (`lineupProgress`, `src/domain/manager-lineup.ts`). Aucun athlète
  engagé : la barre le dit (« Aucun de tes athlètes n'est inscrit… ») et ne propose pas de valider. Bandeaux
  « Alignement validé » et « Verrouillé ».
- **ManagerTutorial** (Manager, #616, #802) : trois écrans plein écran sur le bleu nuit, dans
  les deux thèmes : le principe, la saison (mercato puis journées), l'action. Une idée par écran,
  avec un dessin en formes simples (stade, cartes, dossards ; jamais de photo), sans chiffre (ils
  sont dans « Règles de la ligue »). « Précédent » / « Suivant » (flèches du clavier aussi),
  « Passer » à tout écran ; le dernier propose « Créer une ligue Manager » et « Rejoindre avec un
  code ». S'ouvre seul à la première visite de `/manager` (mémorisé sur l'appareil), puis par
  « Comment ça marche ? ».

- **ManagerHome** (Manager, #606, #774) : `MySeasonCard`, « Ma saison » sur le bleu nuit dans les
  deux thèmes (page de la ligue), et `ManagerStart`, l'onglet sans ligue avec « Le déroulé de la
  saison » ; l'étape en cours vient de `currentSeasonStep`
  (`src/domain/manager-home.ts`), tirée de l'état de la ligue, du mercato, du prochain alignement et
  de la saison. Elle revient à « Alignement » à chaque journée.
- **ManagerLeagueCard** (Manager, #774) : une ligue de « Mes ligues Manager », toute la carte est un
  lien ; phase (`managerPhase`), place, prochaine échéance, pastille de ce qui attend le joueur.
  Sans saison lisible, la carte garde le nom et les participants.

## Ton éditorial

Court, complice, sportif, un peu moqueur. Exemples :
- État vide : « Pas encore de prono ? Même Duplantis commence à 5 m. »
- Raté total : « 0 point. Le chrono ne ment pas. »
- Coup de flair : « Tu l'avais vu venir quand personne ne regardait. 🎯 »

Tout le texte en français, tutoiement.

## Accessibilité et qualité

Contrastes AA minimum, cibles tactiles de 44 px, glisser-déposer toujours doublé d'une
alternative au tap, animations réduites si `prefers-reduced-motion`.

Toute saisie du joueur est bornée (#712) : longueur maximale sur chaque champ (`maxLength`),
reprise côté serveur, et perfs plausibles pour la discipline (#702) avec le message à côté du
champ.
