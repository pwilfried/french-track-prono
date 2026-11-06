# Feuille de route par versions

Chaque version produit quelque chose qu'on peut **ouvrir et tester en local** et devient un
milestone GitHub. On ne passe à la suivante qu'une fois la précédente validée à la main.
Source de référence des critères : [architecture.md](architecture.md), section « Versions ».

| Version | Contenu | Critère de réussite (« It works when… ») |
|---|---|---|
| v0.1 Socle et lecture | Dépôt, app Next.js, Supabase local, thème, liste des épreuves, fiche d'épreuve avec podium officiel | On ouvre sur téléphone la liste des 28 épreuves et la fiche d'une épreuve avec son podium, lus dans la base locale |
| v0.2 Comptes | Connexion par lien magique, profil (pseudo, 15 ans ou plus) | Un nouvel utilisateur reçoit un lien magique, choisit son pseudo et retrouve son profil après déconnexion |
| v0.3 Pronostiquer | PodiumPicker, joker, compte à rebours, verrouillage | Un podium se compose en moins de 20 s ; la base refuse toute modification après `lock_at` |
| v0.4 Back-office et points | Saisie des résultats, calcul des points, écran « mes points » | Les points de joueurs de test correspondent aux cas chiffrés (podium parfait = 12, avec joker = 24) |
| v0.5 Ligues et classements | Création, code d'invitation, classement de ligue et général | Deux comptes dans la même ligue voient le même classement |
| v0.6 Suspense | Coup de flair, révélation des pronos après verrouillage, réactions emoji | Avant verrouillage les pronos des autres sont illisibles (test) |
| v0.7 Mise en ligne | Vercel + Supabase cloud, domaine, premiers testeurs | Un ami s'inscrit depuis son téléphone, fait un prono et peut supprimer son compte |

Plus tard : séries et badges, cartes à partager, questions bonus (voir « Idées pour plus tard »).

## Rejouer l'Ultimate Championship pour tester

Le tournoi est déjà terminé : on simule dans la base de test. Idée : un script de démo qui crée
quelques faux joueurs, leur fait faire des pronos **avant** de charger les résultats, puis lance
le calcul épreuve par épreuve pour vérifier le barème et le classement.

## Tests

- Barème : tests Vitest sur des cas chiffrés (podium parfait, joker, coup de flair, ex æquo).
- Sécurité : vérifier qu'un joueur ne peut ni pronostiquer après verrouillage ni lire les
  pronos des autres avant.
- Interface : parcours principal en test de bout en bout (Playwright) à partir de la v0.3.

## Idées pour plus tard

Pronostics sur performances (temps, marques), import automatique des résultats, notifications
avant verrouillage, saison complète (Diamond League, championnats de France, JO),
version podcast (pronos de l'équipe FrenchTrack et des invités), mode « duel » 1 contre 1.

## Questions ouvertes

1. Nom de l'app : « French Track Prono », « MPP Athlé », autre ?
2. Gratuit ou avec sponsors (lien avec les sponsorings de FrenchTrack) ?
3. Les pronos de la communauté entière sont-ils publics ou seulement par ligue ?
4. Source de données pour les listes de départ réelles.
