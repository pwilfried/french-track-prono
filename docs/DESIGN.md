# Design et expérience

## Principes

1. **Mobile d'abord.** On pronostique dans le métro, pas devant un écran 27".
2. **3 taps pour un prono.** Choisir ses 3 athlètes doit prendre moins de 20 secondes.
3. **Le suspense avant tout.** Compte à rebours avant verrouillage, pronos des autres cachés
   puis révélés d'un coup.
4. **Le chambrage est une fonctionnalité.** Réactions emoji, phrases drôles, classement qui bouge.
5. **Récompenser l'audace**, pas seulement les favoris.
6. **Jamais de page vide.** Chaque état vide a un message amusant et une action claire.

## Identité visuelle (proposition à valider)

L'univers de la piste : tartan, couloirs, chronos.

| Rôle | Couleur | Usage |
|---|---|---|
| Tartan | `#E4572E` | Actions principales |
| Nuit | `#0B1B3A` | Fonds sombres, textes |
| Or | `#FFC857` | Victoires, joker, 1re place |
| Vert vainqueur | `#2BB673` | Points gagnés, bons pronos |
| Craie | `#F7F5F0` | Fond clair |

- **Mode sombre** dès le départ (les soirs de meeting).
- **Typo** : un titre sportif et énergique (Bricolage Grotesque ou Space Grotesk) +
  Inter pour le texte. Chiffres tabulaires pour les chronos et classements.
- **Formes** : coins très arrondis, ombres douces, motif de couloirs de piste en fond d'en-tête.
- **Mascotte** (idée) : un petit sprinter-emoji qui réagit (🏃 😎 🤯 🔥).

## Écrans de la V1

| Écran | Contenu clé |
|---|---|
| Accueil | Compétition en cours, prochaines épreuves, compte à rebours, mon rang |
| Épreuve | Liste de départ, **podium à composer** (glisser-déposer ou taps), joker, verrou |
| Résultat d'épreuve | Podium officiel vs mon prono, points gagnés, confettis si podium parfait |
| Ligue | Classement, derniers pronos révélés, réactions emoji |
| Classement général | Top de la communauté, ma progression |
| Profil | Pseudo, avatar emoji, badges, série en cours |
| Back-office (toi) | Créer compétition/épreuves, saisir les résultats, lancer le calcul |

## Composants clés

- **PodiumPicker** : trois marches (or, argent, bronze), on y dépose ou tape un athlète.
  Sur mobile : tap sur une marche, une feuille s'ouvre avec la liste de départ filtrable.
- **CountdownBadge** : « Verrouillage dans 12 min » qui passe à l'orange puis au rouge.
- **AthleteChip** : drapeau, nom, record de saison.
- **PointsToast** : « +9 pts, vainqueur du 100 m trouvé ! » avec petite animation.
- **LeaderboardRow** : flèche de progression, emoji, flamme si série.
- **ShareCard** : image « Mon podium du 100 m » prête pour les réseaux (et pour le podcast).

## Ton éditorial

Court, complice, sportif, un peu moqueur. Exemples :
- État vide : « Pas encore de prono ? Même Duplantis commence à 5 m. »
- Raté total : « 0 point. Le chrono ne ment pas. »
- Coup de flair : « Tu l'avais vu venir quand personne ne regardait. 🎯 »

Tout le texte en français, tutoiement.

## Accessibilité et qualité

Contrastes AA minimum, cibles tactiles de 44 px, glisser-déposer toujours doublé d'une
alternative au tap, animations réduites si `prefers-reduced-motion`.
