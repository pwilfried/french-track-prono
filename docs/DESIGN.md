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
| Épreuve | Liste de départ, **podium à composer** (glisser-déposer ou taps), joker, verrou |
| Résultat d'épreuve | Podium officiel vs mon prono, points gagnés, confettis si podium parfait |
| Ligue | Classement, derniers pronos révélés, réactions emoji |
| Classement général | Top de la communauté, ma progression |
| Profil | Dossard (grand format, avec le pseudo), club ; saison (tuiles, courbe), derniers pronos, badges et leur progression, classement des clubs, carte à partager |
| Back-office (toi) | Tableau de bord (choses à faire, préparation), compétitions et épreuves, résultats et calcul, listes des clubs, joueurs et ligues |

## Composants clés

- **PodiumPicker** : trois marches (or, argent, bronze) au-dessus de la liste de départ ; on
  touche les athlètes dans l'ordre 1er, 2e, 3e, un appui sur un athlète placé le retire, un appui
  sur une marche la sélectionne (pas de glisser-déposer). Sert aussi à la saisie des résultats.
- **CountdownBadge** : « Verrouillage dans 12 min », neutre, puis orange dès 1 h et rouge dès
  10 min (jetons `--countdown-*` dans `globals.css`, contrastes AA), « 🔒 Verrouillé » ensuite ;
  rien ne clignote.
- **AthleteChip** : drapeau, nom, record de saison.
- **PointsToast** : « +9 pts, vainqueur du 100 m trouvé ! » avec petite animation.
- **Bib** (dossard, #537) : l'avatar du joueur, un numéro (0 à 999) et une couleur parmi six,
  fixes dans les deux thèmes : bleu `#084595` (texte blanc), rouge `#E03020` (texte blanc), or
  `#FFC857` (texte nuit), vert `#2BB673` (texte nuit), blanc (texte nuit, bordure), nuit
  `#052B5C` (texte or, bordure or). Grand format (profil, choix) : coins arrondis, quatre
  épingles, « FRENCH TRACK », le numéro en gros, le pseudo dessous. Petit format (classements,
  en-tête, ligues, réactions) : pastille avec le numéro seul. Couleurs dans `BIB_PALETTE`
  (`src/components/profile/bib.tsx`), reprises par la carte de saison.
- **Leaderboard** : place, dossard, pseudo, points ; ex æquo signalés, ma ligne surlignée,
  raison du départage sous le pseudo (flèche de progression et séries : plus tard).
- **Carte « Ma saison »** (`/profil/carte`) : image verticale 1080×1920 prête pour les stories,
  partagée par le partage natif ou téléchargée ; « Mon podium du 100 m » viendra plus tard.
- **Liste du back-office** (clubs, joueurs, ligues) : recherche, puces de filtre avec leur
  nombre, tableau triable, actions groupées sur la sélection, panneau de détail ; même gabarit
  pour les trois listes.
- **Menu admin** : entrées groupées par rubrique, le tableau de bord en tête.
- **BadgeGrid** : badges gagnés en couleur, les autres grisés avec leur règle ; dessous, le
  prochain badge et ce qu'il reste à faire pour l'obtenir.
- **CompetitionChips** : puces d'une compétition à l'autre (classement, historique des pronos).

## Ton éditorial

Court, complice, sportif, un peu moqueur. Exemples :
- État vide : « Pas encore de prono ? Même Duplantis commence à 5 m. »
- Raté total : « 0 point. Le chrono ne ment pas. »
- Coup de flair : « Tu l'avais vu venir quand personne ne regardait. 🎯 »

Tout le texte en français, tutoiement.

## Accessibilité et qualité

Contrastes AA minimum, cibles tactiles de 44 px, glisser-déposer toujours doublé d'une
alternative au tap, animations réduites si `prefers-reduced-motion`.
