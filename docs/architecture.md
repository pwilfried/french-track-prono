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
6. Pas de messagerie libre : emojis d'une liste fixe et messages prédéfinis seulement, pour éviter
   la modération (confirmé en v0.19 pour le fil de ligue, `docs/decisions/communaute.md`).
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
| F20 | Ligues thématiques : une ligue limitée à une ou plusieurs familles d'épreuves (sprint, haies, lancers…), seul son classement change (v0.17, #613) | Jouer entre spécialistes d'une famille |
| F21 | Communauté : fil de ligue écrit par l'app, réactions par emojis et messages prédéfinis, « Battez FrenchTrack », annonces et sondages de l'admin, « Le saviez-vous ? » (v0.19, `docs/decisions/communaute.md`) | Faire vivre les ligues sans texte libre |

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
- Une seule vérification auth par page (#1021) : le proxy passe à la page l'utilisateur vérifié et
  le profil lu par l'en-tête de requête interne `x-ftp-session` (`src/app/proxied-session.ts`),
  seulement sur GET/HEAD. Il efface toujours celui venu du navigateur (`src/proxy.test.ts`). Les
  server actions (POST) et les routes (`getVerifiedUser`) revérifient auprès de l'auth.
  `auth.getClaims()` n'aiderait pas : le projet signe ses jetons en HS256 (clé symétrique), donc
  elle rappelle `/auth/v1/user`.
- Les paramètres de redirection n'acceptent que des chemins de l'application
  (`src/domain/redirect.ts`).
- En préprod seulement (`PREPROD_DEMO_LOGIN=1`), un admin peut se connecter en tant qu'un joueur
  démo `@example.test` (#637, `src/application/demo-login.ts`) : seul usage de la clé `service_role`
  dans l'application, côté serveur (`src/infra/supabase/demo-accounts.ts`).
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
- Un joueur connecté (#912) lit des autres profils seulement `id`, `pseudo`, `bib_number`,
  `bib_color`, `club_id` et `created_at` (droits colonne par colonne). Son propre profil entier
  (`is_admin`, `age_confirmed_at`…) passe par `read_profile(p_user)`, qui rend aussi n'importe
  quel profil à l'admin ; les fonctions `admin_*` (security definer) lisent toutes les colonnes.
- Alternative écartée : calcul en SQL (`score_event()`), plus atomique mais plus dur à tester
  et à lire pour des agents.

**Pronostics (v0.3).** On compose son podium en touchant les athlètes dans l'ordre (pas de
glisser-déposer) ; le compte à rebours passe à l'orange à 1 h et au rouge à 10 min du
verrouillage. La base refuse un prono après `lock_at`, un athlète hors liste de départ, un
deuxième joker dans la compétition, et la suppression d'un prono après le verrouillage.
Un joueur n'écrit que `p1`, `p2`, `p3`, `use_joker`, `m1`, `m2` et `m3` de ses pronos (droits
colonne par colonne, #911) : l'épreuve, les points et les dates restent écrits par le serveur, et
le verrouillage couvre aussi un changement d'épreuve.

**Résultats et points (v0.4, puis #665).** L'admin saisit une seule feuille de résultats par
épreuve (`/admin/<épreuve>/performances`) : le podium officiel des pronos en est tiré (places 1
à 3, ex æquo compris : les athlètes partagent la place, décision du propriétaire), et
l'enregistrement calcule tout de suite les points (`src/application/save-result-sheet.ts`) ; le
bouton « Recalculer » relance le même calcul en secours. Le coup de flair est calculé sur tous les
pronos de l'épreuve. Le joueur voit le détail dans `/mes-points`. Depuis #666, l'admin peut
coller le tableau de la page de résultats World Athletics : `src/domain/result-import.ts` le lit
(place, nom, pays, marque, records, DNS / DNF / DQ) et le rapproche de la liste de départ par nom
normalisé et pays ; la feuille est seulement pré-remplie, les lignes non reconnues sont listées à
part, et rien n'est enregistré avant « Enregistrer ». Aucun appel réseau vers World Athletics.

**Ligues et classements (v0.5).** Voir « Modèle de données » pour les règles des ligues. Le
classement (`src/domain/ranking.ts`, R9) départage aux points, puis aux podiums parfaits, puis
aux vainqueurs trouvés ; des joueurs toujours égaux partagent la place. Pages : `/ligues`,
`/ligues/[id]`, `/rejoindre/[code]` (lien d'invitation), `/classement`.

**Suspense (v0.6).** Après le verrouillage, la page d'une épreuve montre le podium de tous les
joueurs, avec un filtre par ligue (onglets « Tous » puis une ligue par onglet) ; avant, une case
rappelle que les pronos se dévoilent au verrouillage, et la base ne laisse lire que son propre
prono. Sous le podium d'un autre joueur : six réactions fixes (🔥 😂 😮 👏 🤡 🎯, pas de texte
libre), une par joueur et par prono, qu'on retire en la touchant à nouveau ; pas de réaction sur
son propre prono (décisions du propriétaire, issue #16). Le badge « Coup de flair » est lu dans les points
calculés (`score_events`, raison `flair`) : il suit toujours le barème de la base. Sur l'onglet « Tous les
joueurs », un joueur membre d'au moins une ligue voit d'abord les podiums des membres de ses
ligues ; ceux des autres sont repliés sous « Voir tous les pronos (N) » (#949 :
`listEventPredictions` rend `predictions` et `others`, `src/application/reveal.ts`). Sur cet
onglet, au plus 20 podiums sont dépliés (`REVEAL_SHOWN`), avec ou sans ligue ; les suivants
rejoignent le même pli (#984). Un joueur membre d'une ligue ouvre la section sur sa première
ligue ; « Tous les joueurs » est l'onglet `?ligue=tous` (`revealFilter`, #984).

**Consensus (v0.18, #680).** Au-dessus des podiums, le bloc « Ce qu'ont pronostiqué les joueurs »
remplace l'ancienne répartition « Qui ont-ils vu gagner ? » : pour chaque place, les athlètes
choisis avec leur pourcentage (arrondis qui totalisent 100 %, méthode du plus fort reste), mon
choix surligné ; la part des joueurs qui ont exactement mon podium ; mon choix le plus original
(la place où je suis le moins suivi, la plus haute en cas d'égalité) ; après le résultat, la part
de podiums parfaits (un athlète ex æquo compte à la place qu'il partage). Les onglets « Tous les
joueurs · N » puis une ligue par onglet (« nom · N ») filtrent le bloc comme les podiums. Calcul :
`consensus()` dans `src/domain/consensus.ts` ; données : `event_consensus(événement, ligue)`, qui
rend les podiums sans nom (seulement « le mien »), refuse une épreuve non verrouillée (FT033,
aucune fuite avant le verrou, même par l'API) et une ligue dont on n'est pas membre (42501).

**Battez FrenchTrack (v0.19, #674).** Sur une grande finale, l'admin (le compte FrenchTrack) pose
le podium de FrenchTrack depuis `/admin/<épreuve>/frenchtrack`, avant le verrouillage : l'épreuve
devient un défi. Le joueur voit la carte « Battez FrenchTrack » sur l'épreuve et à l'accueil (le
défi ouvert qui verrouille le premier, sinon le dernier joué) : avant le verrouillage, « posé,
dévoilé au verrouillage » ; après le résultat, les deux podiums côte à côte avec leurs points, le
verdict (« Tu as battu FrenchTrack », « FrenchTrack gagne », « Égalité », pas de prono), la part
des joueurs qui l'ont battu et « Partager ». Les points de FrenchTrack sont calculés avec ceux des
joueurs (même barème, même champ pour le coup de flair, jamais de joker ni de marque :
`frenchTrackScore()` dans `src/domain/frenchtrack.ts`) ; le verdict compare les points du joueur
sur l'épreuve, joker compris. `/classement/frenchtrack` classe la saison (année civile, heure de
Paris) : victoires sur défis joués, puis points cumulés sur ces défis, ex æquo à la même place. Une fois les points calculés, le
défi devient un moment de « Dans ma communauté », sous « FrenchTrack » (#877) : l'épreuve, la part
des joueurs qui ont battu FrenchTrack et mon verdict, la carte mène à l'épreuve. Le moment est daté
par le premier calcul (`frenchtrack_picks.scored_at`) : recalculer garde la date, un seul moment
par épreuve.
Données : table `frenchtrack_picks`, lue et écrite seulement par les fonctions de #674 ;
`admin_set_frenchtrack_pick` et `admin_remove_frenchtrack_pick` (admin, refusées après le
verrouillage, FT034), `admin_set_frenchtrack_points()` (appelée par le calcul des points de
l'épreuve), `frenchtrack_challenge(événement)` (podium caché avant le verrouillage sauf
pour l'admin, puis mes points et ceux de tous sans nom), `frenchtrack_challenges(année)` et
`frenchtrack_season(année)` (pseudo et dossard seulement).

Les décisions du propriétaire prises pendant ces versions sont tracées dans l'issue #112.

**Compétitions du back-office (#647).** `/admin/competitions` filtre ses deux listes (à venir,
passées) par portée, lieu (salle, plein air), niveau et statut (à venir, en cours, terminée) :
quatre rangées de puces, une valeur chacune, gardées dans l'adresse (`portee`, `lieu`, `niveau`,
`statut`, valeur inconnue ignorée). Règles pures : `src/domain/competition-filter.ts`.

**Cache des données publiques (#693).** Les données qui changent rarement et sont les mêmes pour
tout le monde sont gardées d'une requête à l'autre par le cache de données de Next.js ; tout le
reste est relu à chaque page, comme avant.

- Outil : `unstable_cache` + `updateTag` / `revalidateTag` (`next/cache`), le modèle documenté
  sans Cache Components (`node_modules/next/dist/docs/01-app/02-guides/caching-without-cache-components.md`).
  `"use cache"`, `cacheTag` et `cacheLife` demandent `cacheComponents: true`, qui rend toute
  l'application dynamique par défaut, change la navigation (`<Activity>`) et impose des
  `<Suspense>` partout : une migration à part, écartée ici. Le guide de migration garde
  `unstable_cache` tel quel ; on passera à `"use cache"` avec cette migration.
- Ce qui est gardé (`src/app/public-cache.ts`, branché dans `src/app/public-data.ts`), lu avec le
  client anonyme, sans cookie :

  | Lecture | Tag | Pages |
  |---|---|---|
  | Liste des compétitions (`loadCompetitions`, `currentCompetition`) | `competitions` | toutes |
  | Épreuves d'une compétition (`EventReader.listByCompetition` : horaires, verrouillage, tours, statut) | `events` | accueil, compétitions, épreuve, profil, mes points, ligues |
  | Disciplines (`DisciplineRepository.list`) | `disciplines` | règles, profil, ligues |
  | Barème (`loadScale`) | `scale` | accueil, règles |
  | Lignes de score d'une compétition (`RankingRepository.competitionLines`, #824) : pseudo, dossard, club, points ; les mêmes pour tous, déjà publiques (#573) | `rankings` | accueil, classement (général, ce soir, ligue), compétition, ligue, profil (saison, clubs), carte |

- Durée : 120 s (`PUBLIC_CACHE_SECONDS`) ; une invalidation manquée se répare d'elle-même dans ce
  délai. Au sein d'un rendu, une même lecture demandée deux fois (deux ligues sur une même
  compétition) n'est faite qu'une fois (#824). Un classement qui couvre plusieurs compétitions
  (général, saison) les lit par lots de quatre (`linesOf`, `src/application/rankings.ts`, #691) :
  des dizaines de lectures à la fois échouaient de temps en temps.
- Jamais au build : chaque lecture gardée commence par `connection()` (`next/server`). Pendant
  `next build`, le prérendu s'arrête là, avant Supabase ; la page est rendue à la demande. Une
  base lente ou en panne au moment d'un déploiement ne fait donc plus échouer le build (#919).
- Invalidation : chaque action du back-office appelle `publicDataChanged(<changement>)`, qui
  expire à l'instant (`updateTag`) les tags de `STALE_AFTER` : compétition (créer, modifier,
  supprimer, engagés) → `competitions`, `events` ; épreuve (créer, modifier, supprimer), liste de
  départ (saisie, import, qualifiés), cotes, feuille de résultats (qui passe aussi l'épreuve à
  « terminée ») → `events`, `competitions` (une compétition compte ses épreuves et ses engagés) ;
  discipline → `disciplines`, `events` ; barème → `scale`. La feuille de résultats (points
  calculés) expire aussi `rankings`, comme un changement de ce qu'une ligne montre d'un joueur
  (`player` : profil modifié, club choisi, compte supprimé, joueur bloqué ou supprimé par
  l'admin). Un changement fait en SQL directement (scripts `db:*`) attend au plus 120 s.
- Jamais en cache : une épreuve seule (`findBySlug` : sa liste de départ, ses résultats, son
  verrouillage), les pronos, les points du joueur, les ligues et leurs membres, le profil, le
  Manager, et tout ce qui dépend du joueur. Le refus d'un prono après le verrouillage reste décidé
  par la base. Le back-office lit la base directement (les trophées de fin de saison comptent sur
  les lignes fraîches). Lues sans session, les lignes d'un joueur bloqué ne lui sont plus montrées,
  à lui non plus. Un test vérifie que `public-data.ts` ne bâtit ses lectures que sur le client
  anonyme et ne lit ni cookie, ni session, ni joueur (`src/app/public-cache.test.ts`).
- Par requête (#824) : `getSessionClient`, `getCurrentUser` et le profil du joueur
  (`getSessionProfiles`) sont lus une fois par rendu (React `cache`) ; l'en-tête et la page ne
  redemandent plus l'utilisateur à l'auth ni le profil à la base.
- Tests de bout en bout : ils écrivent souvent en SQL. `playwright.config.ts` donne au serveur un
  secret `PUBLIC_CACHE_FLUSH_SECRET` ; avec lui, `POST /api/public-cache` expire tous les tags, et
  `sql()` (`src/infra/contract/database.ts`) l'appelle après chaque écriture (sauf
  `keepCache: true`), puis attend, par `GET /api/public-cache` (une sonde par tag), que chaque tag
  ait expiré : sur Vercel, chacun expire à son tour (#814, #840). Sans ce secret (production), la
  route répond 404.

**Nouvelle tentative sur une lecture (#1020).** `limitedFetch` (`src/infra/supabase/limited-fetch.ts`)
renvoie une fois, après 200 ms, une requête GET ou HEAD dont `fetch` a levé une erreur réseau
(« fetch failed »). Jamais une écriture (elle pourrait être jouée deux fois) ni une réponse HTTP
d'erreur. Chaque nouvelle tentative est journalisée (réussie ou non).

**Navigation instantanée (#824).** Chaque onglet de la barre du bas et la page d'une épreuve ont
un `loading.tsx` (squelette, `PageSkeleton` de `src/components/shell/page-skeleton.tsx`) ; celui
de l'accueil vit dans le groupe `src/app/(accueil)/`, pas à la racine : un squelette racine
envelopperait toutes les pages, et une page introuvable répondrait 200 au lieu de 404. Le routeur du navigateur garde une page
visitée 30 s (`experimental.staleTimes.dynamic`, `next.config.ts`) : revenir sur un onglet ne
redemande rien au serveur. Toute action du joueur qui change des données vide ce cache du
navigateur : `revalidatePath`, `updateTag` (`publicDataChanged`) ou `refresh()` dans son Server
Action (pronos, réactions, ligues, Manager, profil, rappels, e-mail) ; une connexion ou une
déconnexion le vide aussi (cookies changés). Exception assumée : « badges vus » ne rafraîchit
pas, pour ne pas couper la fête du lièvre.

## Modèle de données

Le schéma complet est dans `supabase/migrations/20261106000000_init.sql`.

| Groupe | Tables |
|---|---|
| Joueurs et ligues | `profiles`, `leagues`, `league_members`, `league_competitions`, `league_families` |
| Référentiel | `competitions`, `events` (dont `kind` et `sub_disciplines` des épreuves combinées), `athletes`, `entries` (liste de départ), `results`, `athlete_records` (PR, SB, WR, WB) |
| Jeu | `predictions`, `score_events`, `scoring_rules`, `reactions`, `badges`, `user_badges` (niveau de badge gagné, #821), `trophies` et `trophy_settings` (trophées de saison et compte FrenchTrack du Témoin d'or, #822), `fun_facts` et `fun_fact_settings` (« Le saviez-vous ? », #766) |
| Communauté (v0.19) | `league_moments`, `manager_moments`, `moment_reactions`, `moment_reaction_reports`, `frenchtrack_picks`, `announcements`, `polls`, `poll_votes` |
| Notifications | `push_subscriptions`, `reminder_settings`, `reminder_log`, `program_alerts` |
| Manager (v0.12 à v0.16) | `manager_rules`, `manager_leagues`, `manager_members`, `manager_competitions`, `manager_bids`, `manager_rounds`, `manager_awards`, `manager_round_bids`, `manager_lineups`, `manager_lineup_entries`, `manager_lineup_carry_overs`, `event_performances`, `manager_scores`, `manager_matchdays`, `manager_fixtures`, `manager_honours` (détail : `docs/decisions/french-track-manager.md`) |
| Fonctions | `create_league()`, `add_league_family()`, `join_league()`, `leave_league()`, `transfer_league()`, `enforce_prediction_lock()` (trigger), `can_react()`, `delete_my_account()`, `raise_my_badge_levels()`, `event_consensus()`, `save_reminder_settings()`, `admin_replace_trophies()` |
| Prévues, hors v0.x en cours | `bonus_questions`, `bonus_answers` |

Garanties portées par la base : pronostic impossible après `lock_at`, pronos des autres
illisibles avant verrouillage, un seul joker par joueur et par compétition, un pronostic
par joueur et par épreuve, seuls les athlètes engagés sont pronostiquables.

Ligues (v0.5, décisions du propriétaire dans l'issue #112) : code d'invitation de 6 caractères sans
caractères ambigus (ni 0/O, ni 1/I/L), 50 membres au plus, le créateur passe la main à un membre
avant de partir (seul, partir supprime la ligue). Depuis la v0.9 (#267), une ligue compte une ou
plusieurs compétitions choisies par son créateur (`create_league(nom, slugs[])`) et son classement
additionne leurs points. Depuis la v0.17 (#614, décision du propriétaire du 12 nov. 2026), une
ligue, privée ou publique, naît avec au moins une compétition active, à venir ou en cours (code
FT030 sans compétition, FT009 pour une compétition terminée, jour lu à l'heure de Paris :
`isOpenToLeagues`) ; son créateur en ajoute ensuite d'autres, avec la même règle
(`add_league_competition`). La date d'entrée de chaque compétition est enregistrée
(`league_competitions.added_at`) et le classement de la ligue ne compte que ses épreuves verrouillées
après (`countsSinceEntry`) ; elles comptent toujours au classement général et dans les autres ligues.
Une compétition sans date d'entrée (ligues d'avant #614, Ligue FrenchTrack) compte toutes ses
épreuves. Ligues publiques (v0.7, #277) : tout joueur en crée une (case « Ligue
publique »), elle se rejoint d'un appui sans code (`join_public_league`), 200 membres au plus, et
son nom ne doit contenir aucun mot interdit (`isBannedLeagueName` / `is_banned_league_name`,
code FT010) ; un joueur peut la signaler (`report_league`) et l'admin la renomme ou la supprime
depuis le back-office (Ligues, action journalisée `moderate_league`, #321). Depuis la v0.11 (#383),
le back-office liste toutes les ligues (`admin_list_leagues()`), efface des signalements infondés
(`admin_dismiss_league_reports()`), lit les membres avec leur rang (`admin_league_members()`, même
règle que `countsInLeague`) et retire un membre (`admin_remove_league_member()`, jamais le créateur).
Ligues thématiques (v0.17, #613) : à la création, une ligue compte « Toutes les épreuves » (par
défaut) ou une ou plusieurs familles parmi huit (sprint, haies, demi-fond, fond, sauts, lancers,
épreuves combinées, relais ; les sauts réunissent les deux familles de sauts de `disciplines`),
rangées dans `league_families` (`create_league(nom, slugs[], publique, familles[])`) ; pas de
famille = toutes les épreuves, comme toutes les ligues d'avant. Seul le classement de la ligue
change : il ne compte que les épreuves de ses familles (`countsForFamilies`,
`src/domain/league-families.ts`, appliqué par `getLeagueRanking` avec la famille de la discipline
lue sur chaque ligne de points) ; les pronos, le classement général et ceux des compétitions ne
changent pas. Le créateur ajoute une famille plus tard (`add_league_family`, page
`/ligues/[id]/familles` avec l'aperçu « compte / ne compte pas »), jamais à une ligue sur toutes les
épreuves (FT029), et n'en retire jamais (décision du propriétaire du 13 nov. 2026) : une famille
ajoutée garde sa date (`added_at`) et ne compte que les épreuves qui commencent après. Badge
« Sprint · Haies » sur la carte et la page de la ligue ; dans la ligue, les épreuves des autres
familles sont grisées « Hors ligue » et restent pronostiquables ; les membres voient l'ajout d'une
famille sur la page de la ligue. Ligue officielle (#553) : une seule ligue publique `is_official` (index unique partiel), « Ligue
FrenchTrack », sur les Championnats d'Europe, sans plafond de membres. Elle appartient au premier
compte admin ; la migration la crée par `private.create_official_league()` (idempotente, rien sans
compte admin : la relancer à la main si l'admin arrive après). On la rejoint sur choix, et seul
l'admin la renomme ou la supprime, depuis le back-office. La v0.7 (#311) exigeait une ligue
de la compétition pour pronostiquer (FT011) ; la règle est retirée le 9 novembre 2026 (#375) : on
pronostique sans ligue, et les pages suggèrent seulement d'en créer ou d'en rejoindre une ; le classement général compte tous les points, toutes
compétitions confondues (#319), et l'onglet Classement donne aussi celui de chaque compétition
(#376). L'évolution de rang de l'onglet Classement (#661) est recalculée, sans table : le rang
précédent est celui du classement arrêté à la fin de l'avant-dernière compétition terminée de la
portée (`previousCompetitionSlugs`, `movesSinceCompetitions` dans `src/domain/ranking.ts`) ; un
nouveau joueur n'a pas de flèche, « Ce soir » non plus. Les autres pages (ligues, accueil)
gardent l'évolution depuis la veille. Une ligue de pronos est fermée aux nouveaux dès que la
première épreuve d'une de ses compétitions est verrouillée (#780, décision du propriétaire du
14 nov. 2026, qui remplace l'entrée en cours de route de #376) : `join_league` et
`join_public_league` refusent (code FT032, `LEAGUE_STARTED`), un membre qui rejoint à nouveau est
renvoyé vers la ligue, « Découvrir » ne liste plus les ligues démarrées et la page d'invitation
le dit avant tout bouton (`league_invite_status`, qui compte un code inconnu comme un code erroné,
#155). La Ligue FrenchTrack reste ouverte à tous : c'est la seule où l'on entre en cours de route,
et un membre n'y compte que les épreuves verrouillées après son arrivée (`countsInLeague`, #376) ;
un prono fait avant d'y entrer reste au général et à la compétition. L'accueil du joueur connecté
part de sa prochaine action (#526) : `nextAction` et `leagueStanding` (`src/domain/home.ts`)
choisissent la finale ouverte la plus proche du verrouillage, sinon la prochaine compétition, et la
ligue où il est le mieux classé. Un profil incomplet (ni club ni discipline) y voit la carte
« Complète ton profil » (#540) : la règle, les six familles et les 30 jours de « Plus tard » vivent
dans `src/domain/profile-reminder.ts`, la date dans `player_details.reminder_hidden_until` ; les compétitions d'une ligue se cochent sur `/ligues/creer` dans le sélecteur de saison du Manager (#721 ; l'ancienne page `/ligues/creer/competitions` y redirige), et
les pages suivent la prochaine compétition par date (`src/app/competition.ts`). Ligues et adhésions ne s'écrivent que par les fonctions ci-dessus. Le classement est
calculé en TypeScript à partir des lignes de points (pas de vue SQL).

Ajouts nécessaires au schéma (à faire dans la version indiquée) :

- `profiles.age_confirmed_at` : case « 15 ans ou plus » (v0.2, fait : obligatoire en base). Le pseudo est unique sans tenir compte de la casse.
- `profiles.is_admin` : accès au back-office, réservé à toi (v0.4).
- Suppression de compte et export des données : fonctions SQL (v0.7).
- Les tables de questions bonus ne sont pas utilisées avant leur version. Les badges sont calculés ; `user_badges` garde seulement le niveau le plus haut gagné et montré (#821).

Back-office (v0.8) : la liste de départ, le résultat et le calcul des points passent par les
fonctions `set_start_list()`, `set_results()` et `set_event_scores()`, avec la session de l'admin.
Chacune écrit une ligne dans `admin_actions` (journal lisible par les admins seulement, écrit par
la base elle-même via `private.log_admin_action()`, hors de l'API).

Feuille de résultats (v0.15, issue #429, puis #665) : place, marque, statut (DNS, DNF, DQ) et
indicateurs de records de chaque athlète d'une épreuve, dans `event_performances`. Écriture par
`admin_set_performances()` (journalisée), qui remplace aussi `results` par les arrivés classés 1
à 3 (même règle que `podiumFromPerformances` dans `src/domain/performance.ts`) ; lecture publique ;
`admin_manager_lined_up()` signale à l'admin les athlètes alignés. Détail :
`docs/decisions/french-track-manager.md`, section 4.

Points Manager (v0.15, issue #431) : les tables World Athletics vivent en TypeScript, donc le calcul
se fait côté serveur avec la session de l'admin. `admin_manager_scoring_sheet()` lui donne les
alignements (privés), les performances et les points de pronos de la compétition ;
`src/domain/manager-score.ts` calcule ; `admin_set_manager_scores()` remplace d'un bloc les lignes
de `manager_scores` (journalisée `run_manager_scoring`). Les participants d'une ligue en lisent
les scores ; `my_manager_score()` rend celui du joueur avec le nom de ses athlètes. Depuis #665, le
calcul suit chaque feuille de résultats : tant qu'une épreuve de la compétition n'a pas de
résultat, les scores sont provisoires (`manager_scores.complete` faux, décidé par la base) ; la
confrontation s'affiche, mais ne compte au classement et ne clôt la saison qu'une fois complète.

Calendrier Manager (v0.16, issue #432) : à la clôture du mercato, un déclencheur sur
`manager_leagues.mercato_closed_at` tire une fois le calendrier aller-retour
(`private.schedule_manager_season()`, même règle que `src/domain/manager-schedule.ts`) :
`manager_matchdays` (journée, compétition, bonus) et `manager_fixtures` (confrontations). Les
compétitions de la ligue dont la première épreuve commence au moins 1 h après la clôture, dans
l'ordre des dates : une par journée ; celles au-delà des 2 × (n − 1) journées sont des journées
bonus. Lecture par les participants de la ligue, aucune écriture. Détail :
`docs/decisions/french-track-manager.md`, section 5.

Championnat Manager (v0.16, issue #433) : pas de table de plus. Les participants lisent
`manager_matchdays`, `manager_fixtures` et `manager_scores` de leur ligue
(`ManagerSeasonRepository`) ; `src/domain/manager-championship.ts` en tire les résultats (le plus
haut score Manager gagne, égalité = nul ; 3/1/0) et le classement (points, victoires, différence,
points marqués ; rang partagé sur une égalité complète). Une confrontation compte dès que sa
compétition a des scores Manager (un score absent vaut 0) ; une journée bonus n'en a aucune et ne
donne aucun point de classement. Pages `/manager/[id]/journee/[n]` et `/manager/[id]/classement`.

Confrontation Manager (v0.16, issue #605) : un alignement reste secret jusqu'au verrouillage de sa
compétition (`manager_lineups`, chacun lit les siens) ; ensuite la RPC `manager_duel_lineups`
donne à tout participant de la ligue tous les alignements de cette compétition (`locked` faux et
aucun alignement avant ; 42501 hors ligue). Les points par athlète viennent de
`manager_scores.athletes`. Port `ManagerDuelRepository`, cas d'usage `getManagerDuel` : les deux
alignements placés comme dans le stade (`placeLineup`), le stade de l'adversaire en haut, celui
du joueur en bas, avec les mêmes places (#775)
(pour un membre hors confrontation : l'extérieur en haut). Page
`/manager/[id]/confrontation/[n]/[domicile]`, ouverte depuis chaque carte de la journée.

Fin de saison Manager (v0.16, issue #434) : la saison se termine après la dernière journée du
calendrier, **journées bonus comprises** (décision du propriétaire, 13 nov. 2026), c'est-à-dire
quand chaque journée qui a une compétition a des scores Manager ; une journée sans compétition
ne la retient pas (`seasonOver`, `src/domain/manager-honours.ts`). Un déclencheur sur
`manager_scores` appelle alors `private.close_manager_season()`, qui fige une fois pour toutes
`manager_honours` : champion (le premier du classement ; sur une égalité complète, le premier
arrivé dans la ligue), classement final, confrontations directes et, par joueur, points Manager
marqués (journées bonus comprises) et meilleur athlète. Un calcul refait ensuite ne change rien.
Lecture par les participants (`ManagerHonoursRepository`). Page `/manager/[id]/fin-de-saison`
(rang final, « Ma saison », bilan face au rival : le joueur juste devant, le 2e pour le
champion) ; le palmarès est rappelé dans le profil.

Accueil et tutoriel Manager (v0.16, issues #606 et #616 ; liste des ligues, #774) : pas de table
ni de port de plus. Les cas d'usage `listMySeasons` et `getManagerSeason`
(`src/application/manager-home.ts`) réutilisent les ports de la ligue, de la saison et des
alignements : `/manager` liste une carte par ligue (phase, tour de mercato ouvert et sa fin tirés
de `currentRound` dans `src/domain/manager-round.ts`, rang, verrou d'alignement), `/manager/[id]`
montre « Ma saison » de cette ligue (journée, rang, prochaine confrontation, action du moment ;
pas de rang avant la 1re journée notée, #936) et l'état du mercato tiré de son calendrier prévu
(`mercatoStatus` et `mercatoCalendar`, `src/domain/manager-league.ts`, #925 : tour N en cours,
puis « Mercato terminé » après le dernier tour) ;
l'étape du déroulé vient de
`currentSeasonStep` (`src/domain/manager-home.ts`). Le tutoriel est un composant client
(`ManagerTutorial`) : ouvert seul à la première visite (mémorisé sur l'appareil, rien en base),
sauf pour un joueur déjà dans une ligue Manager (`hasLeague`, #988), puis par `/manager?tutoriel=1` ; trois écrans sans chiffre depuis #802 (les chiffres sont dans
« Règles de la ligue »). Détail :
`docs/decisions/french-track-manager.md`, section 6.

Records (v0.8, issue #196) : le trigger `update_records_from_result` met à jour le PB (`kind = 'pr'` en base) et le SB
à chaque ligne de résultat. Les marques texte sont lues par `parse_mark()` (secondes, mètres ou
points) et comparées par `is_better_mark()` : temps plus bas pour les courses (discipline avec une
distance en mètres, haies, steeple, marche, relais), valeur plus haute sinon. Le SB repart à zéro
avec la première course d'une nouvelle année civile. Un résultat corrigé à la baisse ne fait pas
reculer un record déjà établi. WR et WB se saisissent à la main.

Fiche athlète (v0.18, #679) : `/athletes/[slug]`, ouverte depuis le podium d'une épreuve, le
catalogue du mercato ou une équipe Manager, montre **seulement les records** (décision du
propriétaire : l'app n'a pas l'historique des courses, donc ni résultats récents ni face-à-face).
En tête : initiales (jamais de photo), pays, disciplines ; prix Manager ; puis un bloc par
discipline avec son PB et son SB de la saison en cours (`disciplineRecords` dans
`src/domain/athlete.ts` ; un SB daté d'une année passée est écarté, un SB égal au PB n'est pas
répété). Chaque marque s'affiche une seule fois (#938). Une marque non vérifiée
(`athlete_records.verified`, vraie pour une saisie de l'admin) porte un « ? », expliqué par une
seule légende sous les records. « Retour » ramène d'où l'on vient (`?from=`, #699 : au podium en cours
depuis une épreuve). Cas d'usage `getAthlete`, port `AthleteReader`. Enrichissement depuis
Wikidata (identité, date de naissance, lien Wikipédia, PB quand Wikidata les connaît, jamais les
médailles) : étudié en v0.20 (#895), décision et découpage dans
`docs/decisions/athletes-wikidata.md`, pas encore construit.

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

Salle ou plein air (issue #642) : une compétition a un lieu `venue`, `indoor` (en salle) ou
`outdoor` (en plein air, par défaut), car records de saison et épreuves diffèrent (60 m, 3000 m en
salle). L'admin le choisit à la création et à la modification ; une compétition en salle porte
l'étiquette « Salle » (`VenueChip`), rien ne change pour le plein air. La reprise a mis en salle
les slugs `world-indoor-tour-%` et `european-indoor-championships-%`
(`private.competition_venue`).

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
podium. Depuis #702, une perf doit être plausible pour la famille de la discipline (5 à 20 m pour
un triple saut) : bornes dans `src/domain/mark-range.ts`, reprises par `mark_range()` en base (à
changer ensemble) ; le formulaire le dit à côté du champ, la base refuse (FT031, et
`predictions_marks_bounded` : positive, finie, sous 100 000). Depuis #935, une discipline connue a
ses propres bornes, autour de ses records (3:20 à 5:30 pour un 1500 m, 11 à 19 m pour un triple
saut : `BY_DISCIPLINE`, repris par `discipline_mark_range()`) ; les autres gardent celles de leur
famille. Le joueur peut écrire « 4'02 » ou « 3'35"20 », et « 4,02 » se lit 4:02 quand seule cette
lecture est plausible ; le format attendu (« m:ss.cc », « m.cc »…) s'affiche sous le champ. La
feuille de résultats de l'admin garde les bornes de la famille. Sur la feuille de résultats (saisie
ou collage World Athletics), une marque hors bornes n'est qu'un avertissement que l'admin confirme.
Saisies bornées (#712) : chaque champ joueur a une longueur maximale, reprise par le cas d'usage
(recherches à `SEARCH_MAX_LENGTH`, 60 caractères, dans `src/domain/list-view.ts` ; e-mail à 254 ;
nom de ligue à `LEAGUE_NAME_MAX` ; enchère Manager à `MAX_BID_DIGITS` chiffres, sinon
`MANAGER_BID_INVALID` ; perf à `MARK_MAX_LENGTH`). Points : voir « Cas de test du cœur », S14 à S18 ; le barème est éditable dans
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
#385 ; niveaux bronze, argent, or sur la saison et badges de famille, #821, seul le niveau gagné
est gardé, voir `docs/decisions/badges-et-trophees.md`) ; la bande (#768) : l'animal du joueur,
famille où il a marqué le plus de points de la saison (`src/domain/band.ts`), et les badges en
dossards ; la vitrine des trophées de saison (#822 : statuettes des classements finaux de ligue,
de ligue Manager et du général, plus Chrono figé, Record de ligue et Témoin d'or), tirés en
TypeScript (`src/domain/trophies.ts`, décision B) quand l'admin les attribue depuis
`/admin/trophees` et stockés dans `trophies`, lisibles par le joueur et les membres de ses ligues
(`getTrophyShowcase`, port `TrophyRepository`) ; classement des clubs (`rankClubs`, `src/domain/club-ranking.ts`, #386 : moyenne des points
des joueurs du club, 3 joueurs au moins) ; derniers pronos et historique complet sur
`/profil/pronos` (`pickHits`, `src/domain/prediction-history.ts`, #387) ; carte « Ma saison »
(`/profil/carte`, image 1080×1920 via `next/og`, #388) qui ne reprend que des données publiques
(`seasonCardOf`, `src/domain/season-card.ts` : pseudo, animal, chiffres de la saison, club validé ;
aux couleurs de l'animal, sans dossard depuis #900)
et se partage par le partage natif du téléphone, ou se télécharge à défaut.

« Le saviez-vous ? » (v0.19, #766) : une carte sur l'accueil du joueur, juste sous « Ta prochaine action » (#932), un fait d'athlé,
son étiquette (« Pour tes pronos », « Insolite », « Pour briller au bar »), « Un autre » et × qui la
ferme jusqu'au lendemain (jour de Paris, retenu sur l'appareil). La banque vit dans `fun_facts`
(48 faits de départ chargés par la migration, chacun avec sa source, lue par l'admin seul) ;
l'admin ajoute, modifie, désactive, supprime les faits et affiche ou masque la carte depuis
`/admin/le-saviez-vous`, sans déploiement. Un fait lié à une compétition, une discipline ou des
dates passe en premier ces jours-là, puis la banque tourne d'un fait par jour (`factsOfTheDay`,
`src/domain/fun-facts.ts`). Les faits sur le jeu (podium parfait, joker, perf) ne sont pas dans
la banque : leurs chiffres viennent de `scorePrediction` appliqué au barème en cours
(`gameFigures`), jamais tapés à la main.

Fil de ligue (v0.19, #671) : l'app raconte les moments de chaque ligue de pronos, personne n'y
écrit (pas de texte libre, non-objectif 6). Les moments se déduisent en TypeScript des lignes de
points comptées par la ligue (`leagueMoments`, `src/domain/league-moments.ts`, décision B) :
podium parfait, nouveau leader (seul en tête après une épreuve), série de pronos qui rapportent
(paliers 5, 7, 10). Chaque fait a une clé stable (`perfect_podium:<épreuve>:<joueur>`…) : le
calcul des points de la feuille de résultats (`recomputeResultSheet`) publie ensuite les moments
de toutes les ligues de la compétition par `admin_publish_league_moments()`, qui garde une clé une
seule fois ; relancer le calcul ne publie rien de nouveau. Table `league_moments` : un membre lit
celles de ses ligues, aucune écriture hors des fonctions ; aucun texte stocké, les phrases et les
étiquettes sont dans `messages.fr.ts`. Onglet « Fil » de la page d'une ligue, groupé « Ce soir ·
<compétition> », « Hier », puis par jour (`feedGroups`, heure de Paris).

Communauté de l'accueil (v0.19, #673, décision `docs/decisions/communaute.md`) : le bloc « Dans
ma communauté » rassemble les derniers moments de toutes mes ligues (`getCommunity` fusionne les
fils de chaque ligue, du plus récent au plus ancien, avec le nom de la ligue :
`communityMoments`, `src/domain/community.ts`), les annonces FrenchTrack et les sondages ; « Tout
voir » ouvre `/communaute`. Port `CommunityRepository` (Supabase + fake). Annonces et sondages
viennent de l'admin seul (`/admin/communaute`, fonctions `admin_publish_announcement()`,
`admin_create_poll()`, `admin_remove_…()`) : une annonce a un type énuméré (nouvel épisode, avec
lien d'écoute obligatoire ; compétition qui ouvre ; programme publié), un titre (60 caractères) et
un sous-titre (120) ; un sondage a une question (120), 2 à 4 réponses distinctes (40) et une
clôture à venir. Les joueurs n'écrivent aucun texte : ils votent une fois par `vote_poll()`
(`poll_votes`, clé joueur + sondage) ; `community_polls()` ne donne les votes qu'après le vote du
joueur ou la clôture (l'admin les voit toujours). Les parts s'affichent en pourcentages entiers
qui font 100 (`pollResults`, plus fort reste).

Réactions au fil (v0.19, #672) : les membres d'une ligue réagissent à ses moments sans texte libre.
Quatre emojis (🔥 👏 😮 😂, une réaction de chaque sorte par joueur, retirable, avec compteurs) et
cinq messages prédéfinis (« Bien joué ! », « Quel flair ! », « Revanche ? », « Pas de chance »,
« Je te rattrape » ; un par joueur et par moment, le second remplace le premier), stockés comme des
codes (`src/domain/moment-reactions.ts`, même liste vérifiée en base) ; les emojis et les phrases
sont dans `messages.fr.ts`. Table `moment_reactions` : écritures par `add_moment_reaction()`,
`remove_moment_reaction()`, `send_moment_message()` (membre seulement, en son nom), lecture par
`league_feed_reactions()` sous la sécurité par ligne. Modération (décision du 14 nov. 2026) :
« Signaler » un message (un signalement par joueur et par élément, `moment_reaction_reports`) ;
l'admin voit les « Signalements du fil » en tête de la page « Ligues » du back-office, masque
l'élément (`admin_hide_moment_reaction()`, il disparaît pour tous, noté dans l'historique) ou classe
le signalement. Plafond (#913) : 20 signalements (ligues et fil confondus) par joueur et par
24 h, au-delà `FT035` (`REPORT_LIMIT`) ; resignaler le même élément ne compte pas. Le joueur concerné par un moment reçoit une notification push regroupée quand
d'autres y réagissent (`private.moment_reaction_due()`, famille `league` de `reminder_settings`,
interrupteur « Ma ligue » de « Mes rappels », #903 ; au plus une par heure, mêmes heures calmes).

Fil d'une ligue Manager et badges (v0.19, #875) : l'onglet « Fil » de la page d'une ligue Manager
(`?onglet=fil`, à côté de « Saison ») raconte les athlètes gagnés à la révélation de chaque tour
du mercato (`mercato_win`, depuis `manager_round_bids`) et le résultat de chaque confrontation
dès que sa journée a ses scores Manager (`duel_result`, vainqueur d'abord, score manquant = 0 ;
pas de duel les journées bonus). Ces faits sont déjà stockés : `manager_feed()` les lit (sécurité
par ligne, un non-participant ne lit rien) et `managerMoments` (`src/domain/manager-moments.ts`)
les raconte avec une clé stable (`mercato_win:<tour>:<joueur>`, `duel_result:<journée>:<domicile>`).
Les gains d'un tour sont regroupés par joueur (#979) : une carte « X remporte 4 athlètes au tour 1 ·
40 crédits », dépliable pour les noms et les prix ; duels et badges restent à part. Le fil montre
ses 10 dernières cartes, puis « Voir plus » en ajoute 10.
Un niveau de badge, lui, n'a pas de trace datée : quand le joueur a vu la célébration
(`markBadgesSeen`), `publish_my_badge_moments()` le publie une fois (`badge:<joueur>:<badge>:<niveau>`)
dans chacune de ses ligues de pronos (`league_moments`) et Manager (table jumelle
`manager_moments`), seulement s'il détient ce niveau.

Notifications push (#203) : le joueur les active par appareil depuis son profil (opt-in
explicite, désactivation en un geste). Les abonnements (`push_subscriptions`) ne s'écrivent que
par `save_push_subscription()` et `delete_push_subscription()` ; au plus 10 appareils par joueur,
le plus ancien est remplacé (#913). Chaque minute, l'Edge Function
`push-notifications` lit `private.reminder_due()` et envoie, avec la bibliothèque `web-push` et
les clés VAPID, des rappels groupés (#681, règles de référence dans `src/domain/reminders.ts`) :

- « Pronos oubliés » : un seul message pour toutes les finales de la soirée (date de Paris du
  verrou) qui verrouillent dans le délai choisi (30 min, 1 h ou 3 h ; 1 h par défaut) sans podium
  du joueur, seulement dans une compétition où il a déjà fait un prono ; au plus un par soirée ;
- « Résultats du soir » : un récap quand toutes les finales pronostiquées de la soirée ont leurs
  points (points de la soirée, place dans la compétition) ;
- « Manager » (#836, règles dans `src/domain/manager-reminders.ts`) : fin du tour de mercato
  dans 2 h (aux participants qui peuvent encore recruter) ; alignement non validé quand le verrou
  de la journée tombe dans le délai avant verrou ; duel terminé (toutes les épreuves de la
  compétition finies et les scores Manager calculés depuis moins de 24 h), aux deux joueurs.

« Mes rappels » (`/profil/rappels`) : un interrupteur par famille (Pronos oubliés, Résultats du
soir, Manager, Ma ligue — les réactions d'autres joueurs à mes moments du fil, #903 ; « FrenchTrack »
est stockée mais masquée tant qu'aucune notification ne l'utilise ; une famille masquée garde sa
valeur à l'enregistrement), le
délai avant verrou, les heures calmes (23 h–8 h par défaut, heure de Paris). Rien ne part pendant
les heures calmes : ce qui reste dû part à leur fin. Réglages dans `reminder_settings` (sans ligne :
valeurs par défaut), écrite seulement par `save_reminder_settings()` ; ce qui est parti est noté
dans `reminder_log` (joueur, type, soirée, et pour le Manager la ligue et son tour ou sa
compétition), jamais deux fois. Rien pour un joueur bloqué.

« Me prévenir à la publication » (#659) : sur une compétition sans programme, le joueur connecté
s'abonne (`program_alerts`, écrite seulement par `turn_on_program_alert()` et
`turn_off_program_alert()`, chacun ne lit que ses lignes). Dès que la compétition a sa première
épreuve, l'Edge Function `push-notifications` lit `private.program_due()` et envoie une seule
notification par joueur et par compétition (« 📣 Le programme de … est en ligne », lien vers
l'onglet), notée par `private.program_mark_sent()` ; rien pour un joueur bloqué ou sans appareil.

Textes des notifications (#1016, direction « speaker du stade » : un emoji par famille, le chiffre clé
dans le titre, tutoiement ; `supabase/functions/_shared/push.mjs`) : pronos oubliés « 🚨 Dernier appel :
100 m femmes » ou « … : 3 podiums à poser » ; résultats « 👑 +12 pts, tu es en tête ! » (1er avec des
points), « 🔥 +12 pts ce soir », « 😬 Soirée blanche : 0 pt » (0 point, toujours) ; mercato « 🔨 Mercato :
plus que 2 h pour le tour 2 » ; alignement « 📋 Ton équipe n'est pas alignée » ; duel « 🏆 Victoire contre
X, 42 à 38 pts ! », « 💥 Défaite … », « 🤝 Match nul … » ; fil « 💬 X et 2 autres ont réagi à ton moment » ;
programme « 📣 Le programme de … est en ligne ». Le service worker passe `badge`
(`public/icons/badge-96.png`, silhouette blanche du lapin) et tient la pastille de l'icône de l'app à jour
(`setAppBadge` = notifications affichées, effacée à l'ouverture de l'app ; sans l'API, rien). Le test du
workflow envoie un exemple de chaque (`testNotifications`, un `tag` chacun).

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
| v0.12 Manager : ligues et règles | **F19** : règles fixées par l'admin, ligue publique ou privée de 4 à 10 joueurs, en nombre pair déduit des compétitions choisies (#619, #644) | …un joueur crée une ligue Manager, ses amis la rejoignent, et les règles de la saison sont figées |
| v0.13 Manager : mercato | Enchères secrètes par tours, réservation du budget, attribution, clôture et complément des équipes | …chaque participant d'une ligue finit le mercato avec une équipe validée, sans avoir vu les offres des autres |
| v0.13.1 Refonte des écrans | Accueil qui explique le jeu, profil express, onglets Épreuves (progression, filtres) et Classement (ma ligue, ce soir, général, visiteurs), invitations depuis une ligue, Ligue FrenchTrack officielle | …un nouveau joueur comprend le jeu dès l'accueil, s'inscrit avec un profil express, voit ce qu'il lui reste à faire dans Épreuves, se situe face à ses amis dans Classement, invite ses amis depuis une ligue et peut rejoindre la Ligue FrenchTrack |
| v0.14 Manager : équipe et alignement | Équipe fixe, alignement verrouillé au départ de chaque compétition | …un participant aligne sa sélection et ne peut plus la changer une fois la compétition commencée |
| v0.15 Manager : points | Barème hongrois, bonus sportifs, pronos obligatoires | …le score d'un participant sur une compétition correspond au barème, aux bonus et à ses pronos |
| v0.16 Manager : championnat | Calendrier aller-retour, confrontations, classement, palmarès | …une saison complète désigne un champion et garde son palmarès |
| v0.17 Ligues thématiques | **F20**, onglets Compétitions (programme par jour), Classement (une portée, ma place, évolution depuis la dernière compétition) et Ligues (Mes ligues, Découvrir), sélecteur de compétitions de la saison, ligue créée avec au moins une compétition active, feuille de résultats unique qui calcule pronos et Manager, collage du tableau World Athletics, filtres des compétitions du back-office, cache des données publiques | …un joueur crée une ligue (privée ou publique) limitée à une ou plusieurs familles d'épreuves (sprint, haies, lancers…) ; seuls les pronos sur ces épreuves comptent dans le classement de la ligue ; le classement général et le jeu sans ligue ne changent pas |
| v0.17.1 Préprod en ligne | Site de préprod à adresse fixe déployé à chaque fusion dans `main` (projets Supabase et Vercel séparés, jeu de démo fictif), tests e2e après chaque déploiement et chaque matin, connexion en tant qu'un joueur démo, tag posé sans feu vert humain, bloqué par une préprod rouge | …chaque PR fusionnée dans main est visible quelques minutes plus tard sur un site de préprod à adresse fixe, branché sur sa propre base Supabase avec des données fictives, sans toucher à la prod |
| v0.18 Fiche athlète, consensus et rappels | Fiche athlète (records seulement), consensus des pronos après verrouillage, rappels groupés et « Mes rappels », rappels Manager, bande d'animaux, badges en bronze, argent, or et badges de famille, trophées de saison, icône du lièvre | …depuis une épreuve, le mercato ou une équipe Manager, un joueur ouvre la fiche d'un athlète et voit ses records par discipline ; après le verrouillage d'une épreuve, il voit ce qu'ont pronostiqué tous les joueurs et sa ligue ; il reçoit au plus un rappel groupé avant un verrou s'il lui manque des podiums, et règle ses rappels dans son profil ; il voit aussi sa bande, ses dossards et la vitrine de ses trophées |
| v0.18.1 Premiers pas du joueur | Profil sans épreuve calculée réduit à un encart (prochain badge, prochaine finale), cartes d'épreuve avec l'animal de la famille, le temps restant, mon podium et le vainqueur, « Complète ton profil » en carte compacte qui ouvre une feuille, présentation du Manager en trois écrans, squelettes de chargement, cache du navigateur et lignes de classement en cache | …un nouveau joueur, sur son téléphone, voit d'abord sa prochaine épreuve à pronostiquer, comprend la liste des épreuves d'un coup d'œil (à faire, terminée et ce qu'elle lui a rapporté), trouve un profil qui ne montre pas de cases vides mais lui dit quoi faire pour le remplir, et découvre le Manager en trois écrans |
| v0.19 Communauté | **F21** : fil de ligue (pronos et Manager : podium parfait, nouveau leader, série, enchère gagnée, confrontation, badge), réactions par emojis et messages prédéfinis avec signalement et masquage par l'admin, « Battez FrenchTrack » et son classement de saison, bloc « Dans ma communauté » et page `/communaute` (moments, annonces, sondages), dernier épisode dans la carte du podcast, « Le saviez-vous ? », « Complète ton profil » en deux étapes, carte de saison aux couleurs de l'animal | …dans chaque ligue, un fil raconte tout seul les moments marquants (pronos et Manager) et les joueurs y réagissent par emojis et messages prédéfinis, sans texte libre ; sur les grandes finales, chacun voit s'il a battu le prono de FrenchTrack et un classement de saison le suit ; l'accueil rassemble ces moments, les annonces et les sondages FrenchTrack |
| v0.20 Finitions | Statuettes dessinées dans la vitrine des trophées (animal de la ligue, laurier du général, formes des exploits), classement général lu par lots de quatre compétitions, e2e du profil stabilisés, un seul job e2e de préprod (avant le tag et chaque matin), étude Wikidata pour les fiches athlètes (`docs/decisions/athletes-wikidata.md`), correctifs des audits du 15 nov. 2026 (colonnes d'un prono modifiables par le joueur, colonnes publiques des profils, plafonds de signalements et d'appareils, aucune lecture Supabase au build) | …la vitrine du profil montre les statuettes dessinées de la bande, la feuille « Compléter mon profil » imprime le club sur le dossard puis allume les animaux choisis, le classement général se calcule sans multiplier les lectures en parallèle, les tests de bout en bout du profil ne sont plus instables, et la préprod n'a plus qu'un seul job de tests de bout en bout partagé par le déploiement et le test quotidien |
| v0.20.1 Recette du 15 nov. | Correctifs de la recette utilisateur en préprod : prochaine action avant « Le saviez-vous ? », perfs au format affiché, écritures françaises et bornes par discipline, exemple de marque de la discipline, noms accessibles (perfs, joker, menu du back-office), drapeau de chaque pays CIO, mercato et tour en cours, écrans Manager en liens, stade d'alignement dans l'ovale et feuille réduite aux athlètes possibles, aperçu des onglets Ligues et Manager pour un visiteur, pronos hors de mes ligues repliés, fiche athlète sans doublon, aide « L'animal et les badges », libellés clarifiés, comptes de recette en préprod, restes e2e supprimés, notification de test | …un joueur qui découvre l'app en préprod comprend chaque écran sans explication : il voit d'abord sa prochaine action, saisit une perf dans le format affiché, lit l'état du mercato juste, trouve sur la page de résultat les pronos de ses amis d'abord, et le testeur dispose d'un compte dans chaque état utile |
| v0.20.2 Recette des joueurs de démo | Correctifs de la recette du 15 nov. au soir : joker déjà joué annoncé sur l'épreuve (lien, interrupteur inactif), fil Manager groupé par tour et par joueur avec « Voir plus », barre des compétitions en fin de liste, « À égalité de points », page introuvable en français, boutons d'enchère et réactions nommés, retour du catalogue au nom de la ligue, révélation ouverte sur ma première ligue et repliée après 20 podiums, bandeau de verrouillage neutre jusqu'à la dernière heure, tutoriel Manager sauté pour un joueur déjà en ligue, deux colonnes sur ordinateur (accueil, épreuve) | …en parcourant l'app avec les joueurs de démo, sur mobile en clair et en sombre puis sur ordinateur, aucun point de la recette du 15 nov. au soir ne se reproduit |
| v0.20.3 Performance | Préprod en Francfort (`fra1`), une nouvelle tentative sur les lectures qui échouent en réseau, une seule vérification auth par page (en-tête `x-ftp-session` du proxy), Épreuve et Classement chargés en parallèle, squelette sur `/profil` | …l'app se sent plus rapide en préprod, et une panne réseau passagère ne laisse ni bloc vide ni page d'erreur |
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

**Points Manager (v0.15, tests Vitest).** Tables World Athletics, édition 2025
(`src/domain/world-athletics-points.ts`, #428) ; bonus (`src/domain/manager-bonus.ts`, #430) et
score d'une compétition (`src/domain/manager-score.ts`, #431) avec le barème de test 1re 50,
2e 30, 3e 20, RP 20, MPS 10, RN 40, RC 60, RM 100. Dans le score, les points des tables d'un
athlète sont divisés par `tablesDivisor` (10), à l'entier inférieur, athlète par athlète ; les
pronos ne comptent plus (#1031). M1 à M5 donnent les points bruts des tables.

| # | Situation | Attendu |
|---|---|---|
| M1 | 100 m hommes en 9.58 | 1356 points |
| M2 | 100 m femmes en 10.49 | 1314 points |
| M3 | Saut en hauteur hommes à 2,00 m | 914 points |
| M4 | Décathlon hommes, total officiel 8000 | 1126 points |
| M5 | 100 m hommes en 17.5 (plus lent que le zéro de la table) | 0 point |
| M6 | Relais mixte 4 × 100 m, 110 m haies femmes, discipline inconnue | pas de table : 0 point de table, les bonus comptent |
| M7 | 1re place en finale, RP et MPS | 80 de bonus (50 + 20 + 10) |
| M8 | 4e place, ou DNS, DNF, DQ | pas de bonus de place ; DNS, DNF, DQ : 0 point |
| M9 | Pas d'alignement ; ou des points de pronos sur la compétition | 0 pour la compétition ; les pronos ne changent jamais le score Manager |
| M10 | Même athlète en série (11.20) puis en finale (11.05) de sa discipline choisie ; un 200 m meilleur hors de sa discipline | la meilleure ligne de la discipline (11.05), sans cumul ; le 200 m ne compte pas |
| M11 | 1re place en série avec un RP | RP seul : la place ne compte qu'en finale |
| M12 | Relancer le calcul, ou les performances dans un autre ordre | même score ; le total est la somme des parties, jamais négative |
| M13 | 1 109 points des tables, diviseur 10 ; 0 (DNS) | 110 ; 0 |
| M14 | Équipe A, tables 8 956 au total, 15 de bonus ; équipe B, 8 687 et 66 (cas de référence, #1017) | A 892 + 15 = 907, B 865 + 66 = 931 : B gagne |
| M15 | Seuil 10"50, titulaire en 10"58, remplaçant désigné en 10"70 ; titulaire en 10"42 ou 10"50 (#1033) | le remplaçant compte (`tactical`), même plus lent ; le titulaire compte |
| M16 | Seuil 8,00 m en longueur, titulaire à 7,90 m | le remplaçant compte : moins loin que le seuil |
| M17 | Titulaire DNF, remplaçant désigné DNS ; banc : un sauteur, puis deux sprinteurs | le premier sprinteur du banc qui a une marque (`bench`) |
| M18 | Titulaire DNS, DNF, DQ ou sans performance, remplaçant désigné avec une marque | le remplaçant désigné (`forfeit`) |
| M19 | Titulaire sans marque, personne de sa famille sur le banc | 0 pour la place |
| M20 | Le remplaçant désigné de la place 2 est déjà entré à la place 1 | il n'entre pas deux fois : le suivant du banc, sinon 0 |
| M21 | Seuil franchi, remplaçant désigné sans marque | le titulaire garde sa place |

**Championnat Manager (v0.16, tests Vitest).** Calendrier (`src/domain/manager-schedule.ts`,
#432), résultats et classement (`src/domain/manager-championship.ts`, #433), fin de saison
(`src/domain/manager-honours.ts`, #434), étape de l'accueil (`src/domain/manager-home.ts`, #606).

| # | Situation | Attendu |
|---|---|---|
| C1 | Calendrier de n joueurs (4 à 10, pair) | 2 × (n − 1) journées, un adversaire par journée, chaque paire deux fois (une fois à domicile chacun), aller complet puis retour |
| C2 | Suite des journées d'un joueur | jamais trois fois de suite à domicile ou à l'extérieur, jamais le même adversaire deux journées de suite |
| C3 | Nombre impair de joueurs | aucun calendrier |
| C4 | Compétition dont la première épreuve commence moins de 1 h après la fin du mercato | hors saison ; les autres, dans l'ordre des dates puis des noms, une par journée |
| C5 | Plus de compétitions que de journées de confrontation | les dernières sont des journées bonus : pas de confrontation, pas de point de classement |
| C6 | Confrontation 900 contre 700, puis 650 contre 650 | victoire 3, nul 1, défaite 0 : 4 points contre 1, différence + 200 et − 200 |
| C7 | Égalité de points au classement | victoires, puis différence de points Manager, puis points marqués ; égalité complète : même rang, le suivant sauté |
| C8 | Résultats lus dans un autre ordre | même classement (property test) |
| C9 | Compétition calculée, score d'un participant absent | la confrontation est jouée, le score absent vaut 0 |
| C10 | Journée bonus pas encore calculée, ou journée sans compétition | la saison n'est pas finie tant que la bonus manque ; une journée sans compétition ne la retient pas |
| C11 | Rival à la fin de la saison | le joueur juste devant au classement final, le 2e pour le champion |
| C12 | Étape de l'accueil | ligue tant que le mercato attend, mercato ouvert, alignement à faire, points en attente, confrontations, champion à la fin |

**Ligues thématiques et écrans (v0.17, tests Vitest).** Familles (`src/domain/league-families.ts`,
#613), entrée d'une compétition dans une ligue (`isOpenToLeagues`, `countsSinceEntry`,
`src/domain/league.ts`, #614), évolution de rang (`src/domain/ranking.ts`, #661), collage des
résultats (`src/domain/result-import.ts`, #666).

| # | Situation | Attendu |
|---|---|---|
| L1 | Ligue sans famille | toutes les épreuves comptent, comme avant la v0.17 |
| L2 | Ligue « Sprint · Haies », pronos sur un 100 m et un lancer du poids | seul le 100 m compte au classement de la ligue ; les deux comptent au classement général |
| L3 | Hauteur et triple saut | même famille « Sauts » |
| L4 | Épreuve de famille inconnue dans une ligue limitée | ne compte pas |
| L5 | Famille ajoutée le 1er mars | ne compte que les épreuves qui commencent après ; aucune famille ajoutée à une ligue sur toutes les épreuves |
| L6 | Compétition terminée la veille, heure de Paris | refusée à la création d'une ligue ; à venir ou en cours jusqu'à son dernier jour : acceptée |
| L7 | Épreuve verrouillée juste avant l'entrée de sa compétition dans la ligue | ne compte pas au classement de la ligue ; juste après, elle compte ; sans date d'entrée, tout compte |
| L8 | Évolution de rang dans l'onglet Classement | comparée au classement à la fin de l'avant-dernière compétition terminée ; aucune flèche avec moins de deux compétitions terminées, ni pour un nouveau joueur |
| L9 | Tableau World Athletics collé (tabulations ou espaces, ex æquo, DNS / DNF / DQ, NM) | une ligne par athlète, ex æquo à la même place ; rapproché par nom sans accents et pays, un homonyme d'un autre pays n'est pas pris, les lignes inconnues sont listées à part |

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
