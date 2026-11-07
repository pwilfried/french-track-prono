# French Track Prono — Architecture

Statut : phases 1 à 5 faites (définition, stack, couches, harnais de tests, planification de la
v0.1). La v0.1 est construite ; reste la vérification à la main du critère « It works when… ».
Le calcul des points est dans le domaine TypeScript (décision B, 6 nov. 2026). Les phases 6 à 8
(agents sur GitHub, garde-fous) sont reportées après la v0.1.

Langue : docs du dépôt en français ; code, noms et commentaires de code en anglais.

## Vision

French Track Prono est un jeu web gratuit, pensé pour le mobile, où des amis pronostiquent les
podiums des épreuves d'athlétisme, s'affrontent dans des ligues privées et grimpent au
classement. C'est le pendant « athlétisme » de Mon Petit Prono (football), conçu pour la
communauté du podcast FrenchTrack.

Promesse : intuitif, moderne, facile, drôle, attractif. Un pronostic prend moins de 20 secondes ;
le suspense (compte à rebours, pronos révélés au verrouillage) et le chambrage (réactions
emoji) font partie du jeu, ce ne sont pas des options.

Joueurs : fans d'athlétisme francophones de 15 ans et plus, surtout sur téléphone. Quelques
dizaines à quelques centaines de joueurs au lancement. En ligne uniquement.

Première compétition de test : World Athletics Ultimate Championship, Budapest, 11-13
septembre 2026 (déjà terminée, rejouée dans une base de test).

## Non-objectifs

1. Pas d'argent : ni mise ni gain en espèces. Jeu gratuit (lots symboliques de sponsors
   possibles plus tard).
2. Pas d'application mobile native : un site adapté au mobile suffit.
3. Pas d'import automatique des listes de départ ni des résultats : l'admin les saisit.
4. Pas de pronostics sur les temps ou les marques : uniquement les podiums.
5. Pas de résultats en direct : les points sont calculés quand les résultats officiels sont validés.
6. Pas de messagerie libre : réactions emoji seulement, pour éviter la modération.
7. Pas de photos d'athlètes (droits) : drapeau, initiales et couleurs à la place.
8. Pas de mode hors ligne ni de langue d'interface autre que le français en v1.

## Utilisateurs et contraintes

- Comptes : lien magique par e-mail, pseudo public, avatar emoji. L'e-mail n'est jamais affiché.
- Âge minimum 15 ans (âge du consentement numérique en France), via une case à cocher à
  l'inscription.
- Données personnelles réduites au minimum (e-mail, pseudo). Page de confidentialité,
  suppression de compte et export des données obligatoires (RGPD).
- Budget : 0 € par mois pour la v1 et les tests, sur offres gratuites. À revérifier en phase 2 :
  mise en pause des projets gratuits après inactivité, limites d'usage commercial si un
  sponsor arrive.
- Les faits (noms, résultats, marques) sont utilisés avec la source citée ; pas de logos officiels.
- Code dans un dépôt privé, sans licence open source tant qu'on n'a pas décidé de le publier.
- Accessibilité : contrastes AA, cibles tactiles de 44 px, animations réduites respectées.
- Les secrets (clé service role) restent côté serveur et hors du dépôt.

## Fonctionnalités

Numérotées pour la planification. F11 et F12 sont volontairement repoussées.

| # | Fonctionnalité | Valeur |
|---|---|---|
| F1 | Inscription par lien magique, pseudo, avatar emoji, case « j'ai 15 ans ou plus » | S'inscrire en 10 secondes |
| F2 | Consulter compétitions, épreuves, listes de départ et podiums officiels | Savoir sur quoi on pronostique |
| F3 | Composer son podium (1er, 2e, 3e), compte à rebours, verrouillage automatique | Le cœur du jeu |
| F4 | Ligues privées avec code d'invitation | Jouer entre amis |
| F5 | Classements de ligue et général, avec départage | Se comparer |
| F6 | Back-office admin : créer compétitions et épreuves, saisir listes de départ et résultats | Faire vivre le jeu sans toucher à la base |
| F7 | Calcul automatique des points (barème modifiable) et détail lisible (« +9 pts, vainqueur trouvé ») | Comprendre son score |
| F8 | Joker (un par compétition, double les points d'une épreuve) | Un choix stratégique |
| F9 | Bonus « coup de flair » (points en plus si on trouve un vainqueur peu choisi) | Récompenser l'audace |
| F10 | Pronos des autres révélés après verrouillage, plus réactions emoji | Suspense et chambrage |
| F11 | Séries en feu et badges (repoussée) | Des raisons de revenir |
| F12 | Cartes à partager, ex. « Mon podium du 100 m » (repoussée) | Faire connaître le jeu et le podcast |
| F13 | Page de confidentialité, suppression de compte, export des données | Conformité RGPD |

Barème (modifiable en base) : 3 points par athlète à la bonne place, 1 point pour un athlète sur
le podium mais à la mauvaise place, +3 pour un podium parfait, +2 de bonus coup de flair
(vainqueur choisi par moins de 15 % des joueurs, avec au moins 10 pronos), joker x2.

Points à trancher plus tard : ex æquo sur le podium officiel, athlètes forfaits (0 point),
relais pronostiqués par équipe (pays).

## Stack

Versions vérifiées le 6 novembre 2026 ; à reconfirmer à l'installation (`npm view next version`,
`node --version`).

| Décision | Choix | Raison | Alternative écartée |
|---|---|---|---|
| Langage | TypeScript sur Node.js 24 (LTS actif) | Un seul langage pour le site et l'API, bien maîtrisé par les agents | Node 22 (en maintenance) ; Node 26 (trop récent tant que 24 suffit) |
| Framework | Next.js 16, App Router | Front et API dans un seul projet, déploiement direct sur Vercel ; seule version majeure encore supportée | SvelteKit : plus léger, mais écosystème et exemples plus riches côté React |
| Interface | Tailwind CSS v4 + shadcn/ui | Look moderne et très personnalisable, composants accessibles dont le code nous appartient | MUI, Mantine : plus lourds à personnaliser |
| Base, comptes, sécurité | Supabase : PostgreSQL, lien magique, Row Level Security | Tout-en-un, tourne en local via Docker, sécurité appliquée en base | Neon + Auth.js : plus d'assemblage pour le même résultat |
| Hébergement | Vercel Hobby (gratuit) | Déploiement simple depuis GitHub | Netlify, Cloudflare : non évalués, à voir si Vercel pose problème |
| Tests | Vitest (logique, dont le barème), pgTAP (règles de la base : verrouillage, sécurité), Playwright (parcours principal), Storybook (composants clés seulement : podium, classement, compte à rebours) | Chaque couche testée au plus bas niveau utile | Cypress ; Storybook sur tous les écrans (trop lourd en solo) |
| Langue de l'interface | Textes français regroupés dans un seul fichier, sans bibliothèque d'i18n | Français seul en v1 (non-objectif 8) | next-intl |
| Packaging | Aucun : site web + manifeste PWA pour l'écran d'accueil | Pas d'app native (non-objectif 2) | Application native |
| Documentation utilisateur | Page « Comment ça marche » dans l'app | Une seule source, toujours à jour | Site de documentation séparé |

Risques connus, à surveiller :

- **Supabase gratuit** : mise en pause après une semaine d'inactivité (source secondaire, mai 2026).
  Parade à tester : un appel automatique régulier ; sinon, relance manuelle depuis le tableau de
  bord. Limites utiles : 2 projets, 500 Mo de base, 5 Go de bande passante par mois,
  50 000 utilisateurs actifs par mois.
- **Vercel Hobby** : usage personnel et non commercial uniquement. Un sponsor ou de la
  publicité sur le site impose Vercel Pro (20 $ par utilisateur et par mois d'après leur page)
  ou un autre hébergeur.

## Couches

Architecture en couches vérifiable automatiquement (règle d'import contrôlée dans la CI) :

```
src/domain/        règles pures, sans accès à la base ni au réseau
src/application/   un cas d'usage = un fichier : ses ports (interfaces) + execute()
src/infra/         adaptateurs : Supabase (réel) et fakes en mémoire (tests)
src/app/           pages Next.js, fines : appellent les cas d'usage, aucune règle métier
supabase/          migrations SQL, seed, tests pgTAP (verrouillage et sécurité)
```

Règles :

- `domain` n'importe rien d'autre que lui-même ; `application` n'importe que `domain` ;
  `infra` implémente les ports de `application` ; `app` assemble le tout.
- Un port n'existe que s'il a deux implémentations : l'adaptateur réel et un fake de test.
  Pas de framework d'injection, pas de bus d'événements, pas de dépôt générique.
- Les erreurs sont des types énumérés ; le cœur renvoie des codes (`PREDICTION_LOCKED`,
  `LEAGUE_CODE_UNKNOWN`), jamais des phrases. Les textes français vivent dans le fichier
  de messages de l'interface.

**Comptes et session (v0.2).**

- Connexion sans mot de passe : le même e-mail contient un code à 6 chiffres et un lien. Le code
  marche dans n'importe quel navigateur (utile sur téléphone) ; le lien passe par `/auth/callback`.
- La session vit dans des cookies (`@supabase/ssr`). `src/proxy.ts` la rafraîchit à chaque page et
  envoie un joueur connecté sans profil vers `/bienvenue` (règle pure : `src/domain/profile-gate.ts`).
- Les paramètres de redirection n'acceptent que des chemins de l'application
  (`src/domain/redirect.ts`).
- L'adresse e-mail n'est jamais affichée ni copiée dans `profiles`. Pseudo : 2 à 24 caractères,
  unique sans tenir compte de la casse ; avatar : un des 12 de la liste fixe.
- Pages : `/connexion`, `/bienvenue`, `/profil` ; l'en-tête affiche « Se connecter » ou l'avatar et
  le pseudo.

**Décision B : le calcul des points vit dans le domaine TypeScript** (`src/domain/scoring.ts`,
fonction pure, testée avec Vitest et fast-check).
Raisons : le projet est piloté par des agents, et un cœur pur est plus simple à lire, à
tester et à faire évoluer ; une seule implémentation de la règle, donc pas de doublon à
synchroniser avec l'aperçu affiché dans l'interface.
Conséquences :

- Un cas d'usage `ScoreEvent` (`src/application`) lit résultats, pronos et barème
  (`scoring_rules`), appelle le domaine, puis enregistre les lignes de `score_events` et
  `predictions.points_awarded`.
- L'enregistrement est idempotent (upsert sur `(user_id, event_id)`) et fait en une seule
  transaction ; il est réservé au serveur (clé `service_role`, admin uniquement). Le détail
  (fonction SQL d'écriture `record_scores` ou transaction côté serveur) sera tranché en v0.4.
- Les joueurs ne peuvent pas écrire dans `score_events` (aucune policy d'écriture).
- Alternative écartée : calcul en SQL (`score_event()`), plus atomique mais plus dur à tester
  et à lire pour des agents.

## Modèle de données

Le schéma complet est dans `supabase/migrations/20261106000000_init.sql`.

| Groupe | Tables |
|---|---|
| Joueurs et ligues | `profiles`, `leagues`, `league_members`, `league_competitions` |
| Référentiel | `competitions`, `events`, `athletes`, `entries` (liste de départ), `results` |
| Jeu | `predictions`, `score_events`, `scoring_rules` |
| Vues | `leaderboard_competition`, `leaderboard_league` |
| Fonctions | `join_league()`, `enforce_prediction_lock()` (trigger) |
| Prévues, hors v0.x en cours | `bonus_questions`, `bonus_answers`, `badges`, `user_badges` (F11 et plus tard) |

Garanties portées par la base : pronostic impossible après `lock_at`, pronos des autres
illisibles avant verrouillage, un seul joker par joueur et par compétition, un pronostic
par joueur et par épreuve, seuls les athlètes engagés sont pronostiquables.

Ajouts nécessaires au schéma (à faire dans la version indiquée) :

- `profiles.age_confirmed_at` : case « 15 ans ou plus » (v0.2, fait : obligatoire en base). Le pseudo est unique sans tenir compte de la casse.
- `profiles.is_admin` : accès au back-office, réservé à toi (v0.4).
- Suppression de compte et export des données : fonctions SQL (v0.7).
- Les tables de questions bonus et de badges ne sont pas utilisées avant leurs versions.

## Versions

Chaque version livre quelque chose d'utilisable et devient un milestone GitHub.

| Version | Contenu | It works when… |
|---|---|---|
| v0.1 Socle et lecture | Dépôt, app Next.js, Supabase local, thème, **F2** | …on ouvre sur téléphone la liste des 28 épreuves de l'Ultimate Championship 2026 et la fiche d'une épreuve avec son podium officiel, lus dans la base locale |
| v0.2 Comptes | **F1** | …un nouvel utilisateur reçoit un code et un lien de connexion (boîte de test locale), coche « 15 ans ou plus », choisit son pseudo et retrouve son profil après déconnexion |
| v0.3 Pronostiquer | **F3**, **F8** (joker) | …un joueur compose un podium en moins de 20 secondes avec compte à rebours, et la base refuse toute modification après `lock_at` (vérifié par test) |
| v0.4 Back-office et points | **F6**, **F7** | …l'admin saisit un podium, lance le calcul, et les points de joueurs de test correspondent aux cas chiffrés (podium parfait = 12, avec joker = 24) |
| v0.5 Ligues et classements | **F4**, **F5** | …deux comptes dans la même ligue voient le même classement, départagé par podiums parfaits puis vainqueurs trouvés |
| v0.6 Suspense | **F9** (coup de flair), **F10** (révélation + réactions emoji) | …avant verrouillage les pronos des autres sont illisibles (test), après verrouillage ils s'affichent et on peut réagir en emoji |
| v0.7 Mise en ligne | **F13**, déploiement Vercel + Supabase cloud | …un ami s'inscrit depuis son téléphone sur l'adresse publique, fait un prono et peut supprimer son compte |
| Plus tard | **F11** (séries, badges), **F12** (cartes à partager), questions bonus | à planifier après la v0.7 |

## Cas de test du cœur

Listes de cas chiffrés, référence des tests. Barème : 3 par athlète bien placé, 1 par athlète sur
le podium mal placé, +3 podium parfait, +2 coup de flair, joker x2 (appliqué en dernier).
Le schéma et le seed ont été exécutés sur Supabase local et sont couverts par des tests pgTAP. S1 à S11 sont des tests Vitest purs, S12 et S13 se testent au niveau du cas d'usage.

**Calcul des points (`src/domain/scoring.ts`, tests Vitest)**

| # | Situation | Points attendus |
|---|---|---|
| S1 | Podium parfait dans l'ordre | 12 |
| S2 | Vainqueur trouvé, les deux autres hors podium | 3 |
| S3 | Vainqueur trouvé, 2e et 3e inversés | 5 |
| S4 | Trois bons athlètes, tous mal placés (rotation) | 3 |
| S5 | Aucun athlète sur le podium | 0 |
| S6 | Podium parfait avec joker | 24 |
| S7 | Vainqueur trouvé, choisi par 1 joueur sur 20, autres hors podium | 5 (3 + flair 2) |
| S8 | Même cas que S7 avec seulement 9 pronos sur l'épreuve | 3 (pas de flair sous 10 pronos) |
| S9 | Vainqueur choisi par exactement 15 % des joueurs | pas de flair (seuil strict) |
| S10 | Podium parfait + flair + joker | 28 (maximum possible) |
| S11 | Ex æquo à la 3e place : le prono place l'un ou l'autre des deux en 3e | 3 points de place pour les deux cas : les ex æquo partagent la place (décision du 07/11/2026, #112) |
| S12 | Enregistrer deux fois le même calcul | mêmes points, aucune ligne en double |
| S13 | Calculer une épreuve sans résultat saisi | erreur explicite |

**Règles de la base (tests pgTAP)**

| # | Situation | Attendu |
|---|---|---|
| R1 | Créer ou modifier un prono avant `lock_at` | accepté |
| R2 | Créer ou modifier un prono après `lock_at` | refusé |
| R3 | Lire le prono d'un autre joueur avant verrouillage | invisible |
| R4 | Lire le prono d'un autre joueur après verrouillage | visible |
| R5 | Pronostiquer un athlète non engagé dans l'épreuve | refusé |
| R6 | Même athlète à deux places du podium | refusé |
| R7 | Deuxième joker dans la même compétition | refusé |
| R8 | Rejoindre une ligue avec un code inconnu | erreur |
| R9 | Départage : égalité de points | podiums parfaits, puis vainqueurs trouvés |

**Domaine TypeScript** : aperçu des points possibles (mêmes cas que S1 à S6), état d'une épreuve
selon l'heure (ouverte, verrouillée, terminée), compte à rebours (limites : 1 s avant, pile
au verrouillage, après).
