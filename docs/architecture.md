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

- Comptes : lien magique par e-mail, pseudo public, dossard (numéro et couleur). L'e-mail n'est jamais affiché.
- Âge minimum 15 ans (âge du consentement numérique en France), via une case à cocher à
  l'inscription.
- Données personnelles réduites au minimum (e-mail, pseudo). Page de confidentialité,
  suppression de compte et export des données obligatoires (RGPD).
- Budget : 0 € par mois pour la v1 et les tests, sur offres gratuites. À revérifier en phase 2 :
  mise en pause des projets gratuits après inactivité, limites d'usage commercial si un
  sponsor arrive.
- Les faits (noms, résultats, marques) sont utilisés avec la source citée ; pas de logos officiels.
- Code dans un dépôt public, sans licence open source pour l'instant.
- Accessibilité : contrastes AA, cibles tactiles de 44 px, animations réduites respectées.
- Les secrets (clé service role) restent côté serveur et hors du dépôt.

## Fonctionnalités

Numérotées pour la planification. F11 et F12, d'abord repoussées, arrivent avec le profil de la v0.11.

| # | Fonctionnalité | Valeur |
|---|---|---|
| F1 | Inscription par lien magique, pseudo, dossard (avatar, #537), case « j'ai 15 ans ou plus » | S'inscrire en 10 secondes |
| F2 | Consulter compétitions, épreuves, listes de départ et podiums officiels | Savoir sur quoi on pronostique |
| F3 | Composer son podium (1er, 2e, 3e), compte à rebours, verrouillage automatique | Le cœur du jeu |
| F4 | Ligues privées avec code d'invitation | Jouer entre amis |
| F5 | Classements de ligue et général, avec départage | Se comparer |
| F6 | Back-office admin : créer compétitions et épreuves, saisir listes de départ et résultats | Faire vivre le jeu sans toucher à la base |
| F7 | Calcul automatique des points (barème modifiable) et détail lisible (« +9 pts, vainqueur trouvé ») | Comprendre son score |
| F8 | Joker (un par compétition, double les points d'une épreuve) | Un choix stratégique |
| F9 | Bonus « coup de flair » (points en plus si on trouve un vainqueur peu choisi) | Récompenser l'audace |
| F10 | Pronos des autres révélés après verrouillage, plus réactions emoji | Suspense et chambrage |
| F11 | Séries en feu et badges, avec leur progression dans le profil (v0.11) | Des raisons de revenir |
| F12 | Carte « Ma saison » à partager depuis le profil (v0.11) ; carte « Mon podium du 100 m » plus tard | Faire connaître le jeu et le podcast |
| F13 | Page de confidentialité, suppression de compte, export des données | Conformité RGPD |
| F14 | Plusieurs compétitions (internationales, françaises), accueil par type, ligue sur plusieurs compétitions (v0.9) | Jouer toute la saison |
| F15 | Cotes fixées par l'admin, « Autre athlète », perf pronostiquée par athlète, barème ajustable (v0.9) | Des choix plus fins, plus de suspense |
| F16 | Page « Comment jouer » et premier prono guidé (v0.9) | Comprendre des règles plus riches |
| F17 | Ligues publiques jusqu'à 200 joueurs, sans code, noms modérés, signalement (v0.7) | Jouer avec la communauté FrenchTrack |
| F18 | Gestion des profils : pseudo, dossard, e-mail, club, disciplines ; fiche minimale ; admin chercher, bloquer, supprimer (v0.10, `docs/decisions/profils.md`) | Un compte que le joueur maîtrise |
| F19 | French Track Manager : équipe recrutée aux enchères secrètes, alignement avant chaque compétition, barème hongrois, bonus et pronos, championnat aller-retour (v0.12 à v0.16, `docs/decisions/french-track-manager.md`) | Jouer toute la saison en manager |

Barème (modifiable en base) : 3 points par athlète à la bonne place, 1 point pour un athlète sur
le podium mais à la mauvaise place, +3 pour un podium parfait, +2 de bonus coup de flair
(vainqueur choisi par moins de 15 % des joueurs, avec au moins 10 pronos), joker x2.

Ex æquo : les athlètes partagent la place (décision du 07/11/2026). Forfait : l'athlète ne rapporte
rien. Reste à trancher : relais pronostiqués par équipe (pays).

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
| Tests | Vitest (logique, dont le barème), pgTAP (règles de la base : verrouillage, sécurité), Playwright (parcours principal), Storybook (composants du design system « Officiel », pas les pages) | Chaque couche testée au plus bas niveau utile | Cypress ; Storybook sur tous les écrans (trop lourd en solo) |
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
- L'API de Supabase rend au plus 1 000 lignes par réponse (`max_rows`). Une lecture qui doit
  tout ramener (listes du back-office : clubs, joueurs, ligues, athlètes, compétitions) passe par
  `readAll` (`src/infra/supabase/read-all.ts`), qui lit par paquets jusqu'au bout ; la requête
  a un ordre total (l'id départage) et pas de plafond à elle (#508).

**Comptes et session (v0.2).**

- Connexion sans mot de passe : le même e-mail contient un code à 6 chiffres et un lien. Le code
  marche dans n'importe quel navigateur (utile sur téléphone) ; le lien passe par `/auth/callback`.
- La session vit dans des cookies (`@supabase/ssr`). `src/proxy.ts` la rafraîchit à chaque page et
  envoie un joueur connecté sans profil vers `/bienvenue` (règle pure : `src/domain/profile-gate.ts`).
- Les paramètres de redirection n'acceptent que des chemins de l'application
  (`src/domain/redirect.ts`).
- L'adresse e-mail n'est jamais affichée ni copiée dans `profiles`. Pseudo : 2 à 24 caractères,
  unique sans tenir compte de la casse ; avatar : un **dossard** (#537, `src/domain/bib.ts`),
  numéro de 0 à 999 sans zéro devant et une couleur parmi six (bleu, rouge, or, vert, blanc,
  nuit), pas unique. Un dossard est tiré au hasard à l'inscription (numéro 1 à 99), le joueur le
  change dans « Modifier mon profil ». Un seul composant l'affiche (`Bib`) : grand format sur le
  profil et le choix, pastille avec le numéro ailleurs.
- Pages : `/connexion`, `/bienvenue`, `/profil` ; l'en-tête affiche « Se connecter » ou le
  dossard et le pseudo.
- Profil express (#539) : `/bienvenue` ne demande que le pseudo, le dossard (tiré au hasard,
  modifiable) et la case des 15 ans, puis renvoie le joueur où il allait ; le club et les
  disciplines se complètent depuis l'accueil (« Complète ton profil », #540) ou le profil.

**Décision B : le calcul des points vit dans le domaine TypeScript** (`src/domain/scoring.ts`,
fonction pure, testée avec Vitest et fast-check).
Raisons : le projet est piloté par des agents, et un cœur pur est plus simple à lire, à
tester et à faire évoluer ; une seule implémentation de la règle, donc pas de doublon à
synchroniser avec l'aperçu affiché dans l'interface.
Conséquences :

- Le cas d'usage `computeEventPoints` (`src/application/compute-event-points.ts`) lit le résultat,
  tous les pronos de l'épreuve et le barème (`scoring_rules`), appelle le domaine, puis remplace
  les lignes de `score_events` de l'épreuve. Les raisons sont stockées en codes dans
  `score_events.detail` (`{"reasons": [...]}`), jamais en phrases.
- L'écriture passe par la fonction SQL `set_event_scores` (une transaction : suppression puis
  insertion), donc relancer le calcul ne crée aucun doublon (S12). Elle est appelée avec la
  session de l'admin (`profiles.is_admin`, posé en SQL seulement) : pas de clé `service_role` dans
  l'application.
- Les joueurs ne peuvent pas écrire dans `score_events` (policy `admin_write` réservée à l'admin).
- Un visiteur (`anon`, #573) lit le classement général : les lignes de `score_events` et, des
  profils, seulement `id`, `pseudo`, `bib_number`, `bib_color` et `club_id` (droits colonne par
  colonne), jamais d'un joueur bloqué ; il n'écrit rien.
- Alternative écartée : calcul en SQL (`score_event()`), plus atomique mais plus dur à tester
  et à lire pour des agents.

**Pronostics (v0.3).** On compose son podium en touchant les athlètes dans l'ordre (pas de
glisser-déposer) ; le compte à rebours passe à l'orange à 1 h et au rouge à 10 min du
verrouillage. La base refuse un prono après `lock_at`, un athlète hors liste de départ, un
deuxième joker dans la compétition, et la suppression d'un prono après le verrouillage.

**Résultats et points (v0.4).** L'admin saisit le podium officiel dans `/admin` (ex æquo : les
athlètes partagent la place, décision du propriétaire), puis clique sur « Calculer les points » ;
le coup de flair est calculé sur tous les pronos de l'épreuve. Le joueur voit le détail dans
`/mes-points`.

**Ligues et classements (v0.5).** Voir « Modèle de données » pour les règles des ligues. Le
classement (`src/domain/ranking.ts`, R9) départage aux points, puis aux podiums parfaits, puis
aux vainqueurs trouvés ; des joueurs toujours égaux partagent la place. Pages : `/ligues`,
`/ligues/[id]`, `/rejoindre/[code]` (lien d'invitation), `/classement`.

**Suspense (v0.6).** Après le verrouillage, la page d'une épreuve montre le podium de tous les
joueurs, avec un filtre par ligue (onglets « Tous » puis une ligue par onglet) ; avant, une case
rappelle que les pronos se dévoilent au verrouillage, et la base ne laisse lire que son propre
prono. Sous le podium d'un autre joueur : six réactions fixes (🔥 😂 😮 👏 🤡 🎯, pas de texte
libre), une par joueur et par prono, qu'on retire en la touchant à nouveau ; pas de réaction sur
son propre prono (décisions du propriétaire, issue #16). La répartition « Qui ont-ils vu
gagner ? » est calculée sur tous les pronos de l'épreuve, jamais sur la seule ligue
(`pickDistribution`, `src/domain/reveal.ts`). Le badge « Coup de flair » est lu dans les points
calculés (`score_events`, raison `flair`) : il suit toujours le barème de la base.

Les décisions du propriétaire prises pendant ces versions sont tracées dans l'issue #112.

## Modèle de données

Le schéma complet est dans `supabase/migrations/20261106000000_init.sql`.

| Groupe | Tables |
|---|---|
| Joueurs et ligues | `profiles`, `leagues`, `league_members`, `league_competitions` |
| Référentiel | `competitions`, `events` (dont `kind` et `sub_disciplines` des épreuves combinées), `athletes`, `entries` (liste de départ), `results`, `athlete_records` (PR, SB, WR, WB) |
| Jeu | `predictions`, `score_events`, `scoring_rules`, `reactions` |
| Fonctions | `create_league()`, `join_league()`, `leave_league()`, `transfer_league()`, `enforce_prediction_lock()` (trigger), `can_react()`, `delete_my_account()` |
| Prévues, hors v0.x en cours | `bonus_questions`, `bonus_answers` ; `badges` et `user_badges` restent vides : les badges sont calculés (v0.11) |

Garanties portées par la base : pronostic impossible après `lock_at`, pronos des autres
illisibles avant verrouillage, un seul joker par joueur et par compétition, un pronostic
par joueur et par épreuve, seuls les athlètes engagés sont pronostiquables.

Ligues (v0.5, décisions du propriétaire dans l'issue #112) : code d'invitation de 6 caractères sans
caractères ambigus (ni 0/O, ni 1/I/L), 50 membres au plus, le créateur passe la main à un membre
avant de partir (seul, partir supprime la ligue). Depuis la v0.9 (#267), une ligue compte une ou
plusieurs compétitions choisies par son créateur (`create_league(nom, slugs[])`) et son classement
additionne leurs points. Depuis la v0.7 (#312), une ligue peut aussi naître sans compétition :
son créateur ajoute ensuite des compétitions à venir (`add_league_competition`, code FT009 pour une
compétition déjà commencée). Ligues publiques (v0.7, #277) : tout joueur en crée une (case « Ligue
publique »), elle se rejoint d'un appui sans code (`join_public_league`), 200 membres au plus, et
son nom ne doit contenir aucun mot interdit (`isBannedLeagueName` / `is_banned_league_name`,
code FT010) ; un joueur peut la signaler (`report_league`) et l'admin la renomme ou la supprime
depuis le back-office (Ligues, action journalisée `moderate_league`, #321). Depuis la v0.11 (#383),
le back-office liste toutes les ligues (`admin_list_leagues()`), efface des signalements infondés
(`admin_dismiss_league_reports()`), lit les membres avec leur rang (`admin_league_members()`, même
règle que `countsInLeague`) et retire un membre (`admin_remove_league_member()`, jamais le créateur).
Ligue officielle (#553) : une seule ligue publique `is_official` (index unique partiel), « Ligue
FrenchTrack », sur les Championnats d'Europe, sans plafond de membres. Elle appartient au premier
compte admin ; la migration la crée par `private.create_official_league()` (idempotente, rien sans
compte admin : la relancer à la main si l'admin arrive après). On la rejoint sur choix, et seul
l'admin la renomme ou la supprime, depuis le back-office. La v0.7 (#311) exigeait une ligue
de la compétition pour pronostiquer (FT011) ; la règle est retirée le 9 novembre 2026 (#375) : on
pronostique sans ligue, et les pages suggèrent seulement d'en créer ou d'en rejoindre une ; le classement général compte tous les points, toutes
compétitions confondues (#319), et l'onglet Classement donne aussi celui de chaque compétition
(#376). Dans une ligue, un membre ne compte que les épreuves verrouillées après son arrivée
(`countsInLeague`, #376) : un prono fait avant d'y entrer reste au général et à la compétition. L'accueil du joueur connecté
part de sa prochaine action (#526) : `nextAction` et `leagueStanding` (`src/domain/home.ts`)
choisissent la finale ouverte la plus proche du verrouillage, sinon la prochaine compétition, et la
ligue où il est le mieux classé. Un profil incomplet (ni club ni discipline) y voit la carte
« Complète ton profil » (#540) : la règle, les six familles et les 30 jours de « Plus tard » vivent
dans `src/domain/profile-reminder.ts`, la date dans `player_details.reminder_hidden_until` ; les compétitions par type restent sur `/competitions`, et
les pages suivent la prochaine compétition par date (`src/app/competition.ts`). Ligues et adhésions ne s'écrivent que par les fonctions ci-dessus. Le classement est
calculé en TypeScript à partir des lignes de points (pas de vue SQL).

Ajouts nécessaires au schéma (à faire dans la version indiquée) :

- `profiles.age_confirmed_at` : case « 15 ans ou plus » (v0.2, fait : obligatoire en base). Le pseudo est unique sans tenir compte de la casse.
- `profiles.is_admin` : accès au back-office, réservé à toi (v0.4).
- Suppression de compte et export des données : fonctions SQL (v0.7).
- Les tables de questions bonus ne sont pas utilisées avant leur version ; celles des badges ne servent pas, les badges étant calculés.

Back-office (v0.8) : la liste de départ, le résultat et le calcul des points passent par les
fonctions `set_start_list()`, `set_results()` et `set_event_scores()`, avec la session de l'admin.
Chacune écrit une ligne dans `admin_actions` (journal lisible par les admins seulement, écrit par
la base elle-même via `private.log_admin_action()`, hors de l'API).

Performances Manager (v0.15, issue #429) : place, marque, statut (DNS, DNF, DQ) et indicateurs de
records de chaque athlète d'une épreuve, dans `event_performances`, à part de `results`. Écriture par
`admin_set_performances()` (journalisée), lecture publique ; `admin_manager_lined_up()` signale à
l'admin les athlètes alignés. Détail : `docs/decisions/french-track-manager.md`, section 4.

Points Manager (v0.15, issue #431) : les tables World Athletics vivent en TypeScript, donc le calcul
se fait côté serveur avec la session de l'admin. `admin_manager_scoring_sheet()` lui donne les
alignements (privés), les performances et les points de pronos de la compétition ;
`src/domain/manager-score.ts` calcule ; `admin_set_manager_scores()` remplace d'un bloc les lignes
de `manager_scores` (journalisée `run_manager_scoring`). Les participants d'une ligue en lisent
les scores ; `my_manager_score()` rend celui du joueur avec le nom de ses athlètes.

Records (v0.8, issue #196) : le trigger `update_records_from_result` met à jour le PB (`kind = 'pr'` en base) et le SB
à chaque ligne de résultat. Les marques texte sont lues par `parse_mark()` (secondes, mètres ou
points) et comparées par `is_better_mark()` : temps plus bas pour les courses (discipline avec une
distance en mètres, haies, steeple, marche, relais), valeur plus haute sinon. Le SB repart à zéro
avec la première course d'une nouvelle année civile. Un résultat corrigé à la baisse ne fait pas
reculer un record déjà établi. WR et WB se saisissent à la main.

Disciplines (v0.9, issue #257) : la table `disciplines` porte, pour chaque discipline, sa famille,
son unité (`time`, `distance`, `points`), le sens du classement et la tolérance du prono de
performance, ajustable par l'admin (`/admin/disciplines`, fonction `set_discipline_tolerance()`).
`events`, `athlete_disciplines` et `athlete_records` y renvoient par le nom. `lower_is_better()` lit
la table. Le domaine lit et écrit les marques (`parseMark`, `formatMark` dans
`src/domain/discipline.ts`).

Compétitions (v0.9, issue #266) : l'admin crée une compétition (`scope` internationale ou
française), ses épreuves (slug unique sur toutes les compétitions) et ses engagés
(`competition_athletes`, remplie aussi par chaque ligne de liste de départ). Les candidats d'une
liste de départ sont les engagés de la compétition (tout le monde tant que personne n'est engagé).
La compétition mise en avant est la prochaine par date (`nextCompetition`).

Heure de Paris (décision du propriétaire du 11/11/2026, issue #501) : un seul fuseau pour toute
l'appli, `Europe/Paris`, défini une seule fois (`TIME_ZONE` dans `src/domain/competition.ts`).
L'admin saisit les horaires des épreuves en heure de Paris, quel que soit le pays de la
compétition (`parisToUtc`, `utcToParis`) ; le joueur les lit en heure de Paris, et les épreuves se
regroupent par jour de Paris (`groupEventsByDay`). La base garde des instants UTC ; une compétition
n'a plus de fuseau (colonne `competitions.time_zone` retirée).

Cotes (v0.9, issues #259 et #260) : sur une compétition créée dans le back-office
(`competitions.odds_enabled`), l'admin propose des athlètes de la liste de départ (au moins un, autant qu'il veut ; décision du 08/11/2026) avec une cote positive
chacun, plus une cote « Autre athlète » (`event_odds`, `athlete_id` nul). La finale n'ouvre aux
pronos qu'une fois les cotes saisies (`is_predictable()`). Le joueur choisit parmi les athlètes
proposés ou « Autre athlète » (stocké nul dans `predictions.p1..p3`, une place au plus, FT006
sinon). Perfs (#261) : `predictions.m1..m3`, dans l'unité de la discipline, verrouillées comme le
podium. Points : voir « Cas de test du cœur », S14 à S18 ; le barème est éditable dans
`/admin/bareme` (`admin_set_scoring_rule()`, journalisée).

Profils (v0.10, décisions dans `docs/decisions/profils.md`) : une seule liste de mots interdits
(`src/domain/banned-names.ts` et `is_banned_name()`, FT013) pour les ligues publiques, les pseudos
et les clubs saisis. Clubs : table `clubs` (SIREN unique, `source` import ou joueur, `validated`),
remplie chaque mois par le workflow « Clubs import » (API Recherche d'entreprises) ; recherche
`search_clubs()` sans accents ni casse ; un club saisi par un joueur (`propose_club()`) reste
« à valider » et invisible des autres. Dans le back-office (v0.11, #381), la liste signale un
doublon probable (`likelyDuplicate()` dans `src/domain/club.ts` : même département ou même ville,
mots distinctifs communs) et l'admin le fusionne (`admin_merge_club()`) : ses joueurs passent sur
le bon club et reçoivent une notice « merged ». `profiles.club_id` est public (fiche minimale ouverte depuis
un classement) ; sexe et disciplines vivent dans `player_details`, lisible par son seul
propriétaire. L'e-mail de connexion se change avec un code envoyé sur la nouvelle adresse
(`EmailChangeService`). Après la connexion, tout le monde, admin compris, arrive sur l'accueil
ou sur la page demandée (`next`, même une page `/admin`) : décision du 11 novembre 2026 (#477),
qui remplace celle du 8 novembre (l'admin arrivait sur le back-office). Le back-office a un
tableau de bord (`/admin/tableau-de-bord`, v0.11 #379, lien « Back-office » de l'en-tête : choses à faire, joueurs, préparation de la prochaine
compétition via `ReadinessReader`, dernières actions). Il voit la liste de tous les joueurs (v0.11, #382 :
`admin_list_players()`, points, pronos, ligues, dernière activité, signalements reçus, jamais
l'e-mail ; `admin_player_leagues()` donne le rang dans chaque ligue), bloque (`profiles.blocked_at` : plus de prono ni de ligue,
FT014, et ses lignes ne sont plus lues par les autres joueurs) ou supprime un joueur
(`private.delete_account()`, partagé avec « Supprimer mon compte »), et crée une discipline
(`create_discipline()`). Un compte sans activité depuis 24 mois est supprimé après un e-mail de
prévenance (workflow « Inactive accounts »). Épreuves et accueil suivent d'abord les compétitions
des ligues du joueur (`competitionsForPlayer`).

Profil vivant (v0.11) : tout est calculé en TypeScript à partir des pronos et des points, rien
n'est stocké en plus. Badges et progression vers chacun (`badgeProgress`, `src/domain/badges.ts`,
#385) ; classement des clubs (`rankClubs`, `src/domain/club-ranking.ts`, #386 : moyenne des points
des joueurs du club, 3 joueurs au moins) ; derniers pronos et historique complet sur
`/profil/pronos` (`pickHits`, `src/domain/prediction-history.ts`, #387) ; carte « Ma saison »
(`/profil/carte`, image 1080×1920 via `next/og`, #388) qui ne reprend que des données publiques
(`seasonCardOf`, `src/domain/season-card.ts` : pseudo, dossard, chiffres de la saison, club validé)
et se partage par le partage natif du téléphone, ou se télécharge à défaut.

Notifications push (#203) : le joueur les active par appareil depuis son profil (opt-in
explicite, désactivation en un geste). Les abonnements (`push_subscriptions`) ne s'écrivent que
par `save_push_subscription()` et `delete_push_subscription()`. Toutes les 5 minutes, le workflow
« Push notifications » lit `private.push_due()` et envoie, avec la bibliothèque `web-push` et les
clés VAPID : un rappel jusqu'à 20 minutes avant le verrouillage d'une finale non pronostiquée,
seulement dans une compétition où le joueur a déjà fait un prono, puis ses points une fois
calculés. Une notification par heure au plus, jamais deux fois la même (`push_log`), rien pour un
joueur bloqué. Pas de clé service_role : le workflow passe par l'API Management de Supabase,
comme « Inactive accounts ».

Tours (v0.8, issue #198) : une série, un quart ou une demi-finale pointe vers le tour qu'il
alimente (`events.parent_id`). On ne pronostique que les finales, et une finale seulement quand
tous ses tours précédents sont terminés (`is_predictable()`, vérifié par le trigger de
verrouillage, code FT001). `promote_to_next_round()` qualifie les N premiers d'un tour (ex æquo
compris). Pas de colonne `is_predictable` stockée : la règle est calculée, elle ne peut pas
diverger du statut des tours. Les joueurs ne voient que les finales dans la liste.

Fonctions SQL (#457) : règle pour toute nouvelle fonction, vérifiée par
`supabase/tests/function_rights.test.sql` (le test lit `pg_proc`, il vaut donc pour les fonctions
à venir) :

- `set search_path = public` (ou `public, extensions`) dans sa déclaration ;
- une fonction de trigger : `revoke execute … from public, anon, authenticated` (le trigger
  l'exécute quand même) ;
- une fonction appelée par l'application : `revoke execute … from public, anon` puis
  `grant execute … to authenticated`. Depuis #457, une nouvelle fonction n'est plus exécutable par
  `anon` par défaut ; l'ouvrir à `anon` demande de l'ajouter, avec sa raison, à la liste du test
  (aujourd'hui `search_clubs()`, `club_search_key()` et `club_key_matches()`, pour le choix du
  club avant l'inscription, et `is_blocked()`, pour le classement général des visiteurs).
  Une fonction appelée par une policy ouverte à `anon` doit y figurer, sinon les lectures publiques
  cassent ;
- une fonction `admin_*` commence par `if not is_admin() then raise … using errcode = '42501'` ;
  une fonction `security definer` qui écrit refuse d'abord un appelant sans identité
  (`auth.uid() is null`, 42501) puis vérifie ses droits (créateur, membre…) ;
- une fonction réservée aux workflows (base de données en tant que propriétaire) vit dans le
  schéma `private`, hors de l'API, avec `revoke execute … from public, anon, authenticated`.

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
| v0.7 Mise en ligne | **F13**, **F17**, déploiement Vercel + Supabase cloud, domaine, e-mails Resend, pages légales, ligue obligatoire pour pronostiquer, classement général toutes compétitions, test de la prod | …un ami s'inscrit depuis son téléphone sur l'adresse publique, fait un prono et peut supprimer son compte |
| v0.8 Jeu vivant, admin, athlètes, appli | Aperçu du calcul, listes de départ, journal admin, épreuves combinées, appli installable, records, fiche athlète, tours | …l'admin prépare une finale (tours, liste de départ, résultat, calcul) sans toucher à la base, et l'appli s'installe sur le téléphone |
| v0.9 Cotes et performances | **F14**, **F15**, **F16** | …un joueur choisit des compétitions françaises sur l'accueil, crée sa ligue dessus, pronostique un podium avec cotes et perfs, et ses points comptent cotes et perfs selon le barème réglé par l'admin |
| v0.10 Profils et inscription | **F18**, inscription enrichie (club, sexe, disciplines), captcha, installation sur iPhone | …un joueur s'inscrit avec son club et ses disciplines, et gère son profil |
| v0.11 Back-office et profil | Tableau de bord admin, listes filtrables (clubs, joueurs, ligues), **F11**, **F12** (carte « Ma saison »), classement des clubs, historique des pronos | …un admin traite tout ce qui est à faire depuis un tableau de bord, trouve en deux gestes un club, un joueur ou une ligue grâce aux filtres, et un joueur ouvre un profil vivant (stats, courbe, badges, club) |
| v0.12 Manager : ligues et règles | **F19** : règles fixées par l'admin, ligue publique ou privée de 4 à 12 participants | …un joueur crée une ligue Manager, ses amis la rejoignent, et les règles de la saison sont figées |
| v0.13 Manager : mercato | Enchères secrètes par tours, réservation du budget, attribution, clôture et complément des équipes | …chaque participant d'une ligue finit le mercato avec une équipe validée, sans avoir vu les offres des autres |
| v0.13.1 Refonte des écrans | Accueil qui explique le jeu, profil express, onglets Épreuves (progression, filtres) et Classement (ma ligue, ce soir, général, visiteurs), invitations depuis une ligue, Ligue FrenchTrack officielle | …un nouveau joueur comprend le jeu dès l'accueil, s'inscrit avec un profil express, voit ce qu'il lui reste à faire dans Épreuves, se situe face à ses amis dans Classement, invite ses amis depuis une ligue et peut rejoindre la Ligue FrenchTrack |
| v0.14 Manager : équipe et alignement | Équipe fixe, alignement verrouillé au départ de chaque compétition | …un participant aligne sa sélection et ne peut plus la changer une fois la compétition commencée |
| v0.15 Manager : points | Barème hongrois, bonus sportifs, pronos obligatoires | …le score d'un participant sur une compétition correspond au barème, aux bonus et à ses pronos |
| v0.16 Manager : championnat | Calendrier aller-retour, confrontations, classement, palmarès | …une saison complète désigne un champion et garde son palmarès |
| Plus tard | Carte « Mon podium du 100 m », questions bonus, connexion Google / Apple | à planifier |

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

**Cotes et perfs (v0.9, #262), en plus du barème ci-dessus.** Sur une épreuve à cotes, chaque athlète
proposé (ou « Autre athlète ») sur le podium rapporte sa cote × 3 à la bonne place, × 2 à une place
d'écart, × 1 à deux places, arrondi au point. « Autre athlète » est juste quand un athlète non
proposé finit à cette place. Une perf rapporte 5 dans la tolérance de la discipline, 2 dans le
double. Le joker double le tout. Ces valeurs sont des lignes de `scoring_rules`, modifiables dans
`/admin/bareme`. Cas : cotes A 2, B 3, C 1,5, autre 8 ; résultat A 1er (10.79), B 2e (10.87),
X 3e non proposé, C 4e ; tolérance 0,05.

| # | Situation | Points attendus |
|---|---|---|
| S14 | A, B, C | 21 (3 + 3, cotes 6 + 9) |
| S15 | C, A, autre athlète | 32 (1 + 3, cotes 2 × 2 + 8 × 3) |
| S16 | B, C, A avec A seul proposé à 1,8 | 4 (1 + 1, cote 1,8 × 1 = 2) |
| S17 | A, B, C avec perfs 10.81 et 10.95 | 28 (21 + 5 + 2) |
| S18 | A, B, C, joker, perf 10.81 | 52 ((21 + 5) × 2) |

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
