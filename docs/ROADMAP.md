# Feuille de route par itérations

Chaque itération produit quelque chose qu'on peut **ouvrir et tester en local**. On ne passe
à la suivante qu'une fois la précédente validée.

| # | Itération | On obtient | Critère de réussite |
|---|---|---|---|
| 0 | **Socle** | Dépôt GitHub, app Next.js, Supabase local, types générés, thème (couleurs, polices, mode sombre) | `npm run dev` affiche une page d'accueil aux couleurs du projet, connectée à la base |
| 1 | **Lecture seule** | Liste des épreuves, fiche d'épreuve avec liste de départ, podium officiel (données de test) | On navigue dans l'Ultimate Championship 2026 sur mobile |
| 2 | **Comptes** | Connexion par lien magique, profil (pseudo + avatar emoji) | Je crée un compte et je vois mon pseudo |
| 3 | **Pronostiquer** | PodiumPicker, joker, compte à rebours, verrouillage | Je fais un prono en moins de 20 s ; impossible après verrouillage |
| 4 | **Ligues** | Création, code d'invitation, classement de ligue et général | Deux comptes de test se retrouvent dans la même ligue |
| 5 | **Résultats et points** | Back-office de saisie, calcul des points (domaine TypeScript) et enregistrement, écran « mes points » | Je saisis un podium, les points s'affichent et sont corrects |
| 6 | **Couche fun** | Confettis, série en feu, coup de flair, badges, réactions, cartes à partager | Une session de test fait sourire |
| 7 | **Mise en ligne** | Vercel + Supabase cloud, domaine, premiers testeurs | Un ami s'inscrit depuis son téléphone |

## Rejouer l'Ultimate Championship pour tester

Le tournoi est déjà terminé : on simule dans la base de test. Idée : un script de démo qui crée
quelques faux joueurs, leur fait faire des pronos **avant** de charger les résultats, puis lance
le calcul épreuve par épreuve pour vérifier le barème et le classement.

## Tests

- Barème : tests Vitest sur des cas chiffrés (podium parfait, joker, coup de flair, ex æquo).
- Sécurité : vérifier qu'un joueur ne peut ni pronostiquer après verrouillage ni lire les
  pronos des autres avant.
- Interface : parcours principal en test de bout en bout (Playwright) à partir de l'itération 3.

## Idées pour plus tard

Pronostics sur performances (temps, marques), import automatique des résultats, notifications
avant verrouillage, saison complète (Diamond League, championnats de France, JO),
version podcast (pronos de l'équipe FrenchTrack et des invités), mode « duel » 1 contre 1.

## Questions ouvertes

1. Nom de l'app : « French Track Prono », « MPP Athlé », autre ?
2. Gratuit ou avec sponsors (lien avec les sponsorings de FrenchTrack) ?
3. Les pronos de la communauté entière sont-ils publics ou seulement par ligue ?
4. Source de données pour les listes de départ réelles.
