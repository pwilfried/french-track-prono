# Conception

## 1. Vision

Rendre le pronostic d'athlétisme aussi simple et addictif que le pronostic de foot : en
quelques secondes, on compose son podium, on rejoint une ligue d'amis, on suit son
classement et on chambre ses potes quand le favori s'écroule.

**Public** : auditeurs de FrenchTrack et passionnés d'athlé, mobile d'abord.

**Promesse** : intuitif, moderne, facile, drôle, attractif. Chaque choix technique ou
visuel est jugé à cette aune.

## 2. Règles du jeu

### Pronostic
Pour chaque épreuve, le joueur désigne **3 athlètes** : 1er, 2e, 3e. Le pronostic est
modifiable jusqu'à l'heure de verrouillage (`lock_at`, 5 min avant le départ), puis figé.
Les pronos des autres joueurs ne deviennent visibles **qu'après verrouillage**.

### Barème (stocké en base, table `scoring_rules`, modifiable sans toucher au code)

| Situation | Points |
|---|---|
| Bon athlète à la bonne place | 3 par place |
| Athlète sur le podium, mauvaise place | 1 |
| Podium parfait (bonus) | +3 (donc 12 max) |
| Coup de flair : vainqueur trouvé, choisi par moins de 15 % des joueurs (min. 10 pronos) | +2 |
| Joker (1 par compétition) | points de l'épreuve × 2 |

Départage : points, puis podiums parfaits, puis vainqueurs trouvés.

### Prévu après la V1
Série en feu (+1 après 3 épreuves de suite avec des points), questions bonus (record battu,
médailles françaises), badges (Nostradamus, Chasseur d'outsiders, Fan des Bleus).
Les tables sont déjà dans le schéma.

### Points à trancher plus tard
- Ex æquo sur le podium officiel (ex. hauteur dames, deux 3es) : le schéma les gère (même rang),
  le calcul actuel compte les deux comme « sur le podium ».
- Forfaits : un athlète qui ne court pas rapporte 0.
- Relais : on pronostique des équipes (pays), pas des athlètes.

## 3. Architecture

```
Navigateur (mobile d'abord)
        │
Next.js (pages, Server Actions, route handlers)
        │  @supabase/ssr
Supabase : Auth (lien magique) · PostgreSQL · Row Level Security
        │
Fonctions SQL : join_league() (le calcul des points est dans le domaine TypeScript)
```

Principes :
- **La logique de points vit dans le domaine TypeScript** (fonction pure), enregistrée de façon
  idempotente côté serveur : on peut la relancer après correction d'un résultat.
- **La sécurité vit en base** (RLS + trigger de verrouillage) : même si le front est contourné,
  on ne peut pas pronostiquer après le départ ni lire les pronos des autres avant.
- **Données de référence** (compétitions, épreuves, résultats) : écrites par le back-office
  avec la clé « service role », jamais exposée au navigateur.
- **Un seul langage** (TypeScript) côté app, types générés depuis la base
  (`supabase gen types typescript`).

## 4. Modèle de données (déjà écrit : `supabase/migrations/20261106000000_init.sql`)

| Groupe | Tables |
|---|---|
| Joueurs et ligues | `profiles`, `leagues`, `league_members`, `league_competitions` |
| Référentiel | `competitions`, `events`, `athletes`, `entries` (liste de départ) |
| Jeu | `predictions`, `results`, `score_events`, `bonus_questions`, `bonus_answers` |
| Progression | `badges`, `user_badges`, `scoring_rules` |
| Vues | `leaderboard_competition`, `leaderboard_league` |

À savoir sur les données de test (`supabase/seed.sql`) :
- 28 épreuves, podiums seulement (rang 1 à 3) + finalistes français. Source : NBC Sports.
- **Jours et ordre de passage** tirés du communiqué de World Athletics (sous réserve de modifications) : vendredi 19 h-22 h, samedi et dimanche 18 h-21 h, heure de Budapest. Les **heures exactes sont des estimations** (réparties dans la plage selon l'ordre de passage) : à remplacer par le programme officiel.
- **Saut en longueur dames** : la source donne un ordre incohérent avec les marques, à vérifier.
- Pour tester le jeu, il faudra des listes de départ plus complètes que les podiums.

## 5. Choix techniques et alternatives écartées

| Choix | Pourquoi | Écarté |
|---|---|---|
| Supabase | Auth + BDD + sécurité par ligne dans un seul outil, tourne en local | Firebase (NoSQL peu adapté aux classements), backend maison (trop long pour une V1) |
| Next.js | Un seul projet pour front et API, déploiement simple sur Vercel | SPA React + API séparée |
| Tailwind + shadcn/ui | Interface moderne rapide, composants accessibles, tout reste modifiable | UI kit lourd (MUI) |
| Connexion par lien magique | Pas de mot de passe, inscription en 10 secondes | Mot de passe classique |

## 6. Sources de données (à décider)

V1 : saisie manuelle des listes de départ et des résultats via un petit back-office.
Plus tard : import depuis une source d'athlétisme (à étudier : licence, fiabilité, coût).
