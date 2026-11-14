# Badges et trophées

Issue #807, validée par le propriétaire le 14 novembre 2026, avec la direction artistique de #768
(maquette « Badges et trophées »). Ce document fixe les règles ; le code suit.

## Principes

- **Un badge est un dossard.** Il récompense une façon de jouer. Il se gagne au fil de la saison
  en **bronze, argent puis or**, et ne se perd jamais. Pas encore gagné, il apparaît grisé avec ce
  qu'il manque (« encore 2 »).
- **Un trophée est une statuette.** Il récompense un classement final (une ligue de pronos, une
  ligue Manager, le classement général) ou un exploit. Il appartient à une saison et peut se
  regagner la saison suivante. Il est posé dans la vitrine, une étagère par saison.
- **Les animaux** : le lièvre, mascotte, porte les badges de jeu ; chaque famille d'épreuves a son
  animal et son badge de famille (familles de #613).
- **Les badges gagnés avant ces règles** deviennent bronze : rien ne se perd.
- **Le prochain badge** proposé au joueur est celui au plus petit effort restant (#768).
- **Saison** : l'année des compétitions, comme le classement général.

## Badges de jeu (lièvre)

| Badge | Compte | Bronze | Argent | Or |
|---|---|---|---|---|
| Nostradamus | Podiums parfaits (les trois dans l'ordre) | 1 | 3 | 10 |
| Chasseur | Vainqueurs trouvés | 3 | 10 | 30 |
| Flair | Coups de flair | 1 | 3 | 10 |
| Série | Meilleure suite d'épreuves calculées avec des points | 5 | 10 | 20 |
| Bleus | Vainqueurs français trouvés | 1 | 5 | 15 |
| Fidèle | Journées dont toutes les épreuves ont été pronostiquées | 1 | 5 | 15 |

## Badges de famille

Points gagnés dans la famille sur la saison : **bronze 50, argent 150, or 400**.

| Badge | Famille | Animal |
|---|---|---|
| Foudre | Sprint | Guépard |
| Haies hautes | Haies | Impala |
| Train d'enfer | Demi-fond et fond | Lièvre |
| Grand bond | Longueur et triple saut | Kangourou |
| Envol | Perche et hauteur | Chat |
| Force tranquille | Lancers | Ours |
| Touche-à-tout | Épreuves combinées | Renard |

## Trophées

| Trophée | Condition | Forme |
|---|---|---|
| Ligue de pronos | 1er, 2e ou 3e au classement final d'une ligue d'au moins 4 joueurs | Statuette de l'animal de la famille la plus jouée dans la ligue, en or, argent ou bronze (« Guépard d'or ») |
| Manager | 1er, 2e ou 3e au classement final d'une ligue Manager | Lièvre d'or, d'argent ou de bronze |
| Classement général | Top 10 de la saison | Laurier : or (1er), argent (2e et 3e), bronze (4e à 10e) |
| Chrono figé | Meilleure soirée de la saison dans une ligue (le plus de points en une soirée) | Chronomètre |
| Témoin d'or | Finir une compétition devant le compte FrenchTrack au classement général | Témoin de relais doré |
| Record de ligue | Battre le record de points en une compétition de sa ligue | Plaque gravée |

## Réglages par défaut, révisables

Le propriétaire a validé la proposition sans trancher ces points ; ils valent jusqu'à nouvel ordre :

- Les seuils ci-dessus sont ceux de la première saison ; ils seront revus avec les vrais chiffres.
- Le compte FrenchTrack du Témoin d'or est désigné dans le back-office (réglage de l'admin) ;
  sans compte désigné, le trophée n'est pas proposé.
- Badges et trophées s'affichent sur le profil du joueur et pour les membres de ses ligues, comme
  le reste de son profil.

## Mise en œuvre des trophées (#822)

- **Calcul** : en TypeScript, comme les points (décision B) : `src/domain/trophies.ts`. L'admin
  attribue les trophées d'une saison depuis le back-office (« Trophées », `/admin/trophees`) ;
  relancer remplace les trophées de la saison d'un coup (`admin_replace_trophies`), sans doublon
  (un trophée par joueur, saison, sorte et ligue). C'est aussi là qu'il désigne le compte
  FrenchTrack, par son pseudo.
- **Quand un trophée est acquis** : une ligue de pronos est finie le lendemain du dernier jour de
  sa dernière compétition, et sa saison est l'année de ce jour ; une ligue Manager à la fin de sa
  saison (#434), l'année de cette fin ; le Témoin d'or à la fin de chaque compétition ; le top 10
  du général une fois l'année finie.
- **Ex æquo** : les joueurs encore à égalité au classement (points, podiums parfaits, vainqueurs
  trouvés) partagent la place, donc le métal (1, 2, 2, 4 : or, argent, argent, rien). Un joueur
  sans point n'a jamais de trophée ; un membre sans point compte quand même dans les 4 joueurs.
- **Animal de la ligue** : la famille qui a le plus de lignes de points dans la ligue ; à égalité,
  l'ordre du tableau des badges de famille ; les relais, sans animal, vont au lièvre.
- **Chrono figé** : le plus de points d'une soirée (journée de compétition, heure de Paris) dans
  une ligue finie ; à égalité, tous les joueurs concernés.
- **Record de ligue** : battre (strictement) le meilleur total d'une compétition précédente de la
  ligue ; la première compétition pose le record, une fois par ligue.
- **Témoin d'or** : finir strictement devant le compte FrenchTrack au classement d'une compétition,
  une fois par saison ; si le compte n'a pas joué la compétition, personne ne le gagne.
- **Qui voit** : le joueur et les membres de ses ligues (pronos et Manager), sécurité par ligne.
