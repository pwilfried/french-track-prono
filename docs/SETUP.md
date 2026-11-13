# Installation et outils

Objectif : tout faire tourner **en local** sur ton ordinateur, avec le code sur GitHub.

## 1. Outils à télécharger

| Outil | À quoi il sert | Où le prendre |
|---|---|---|
| **Git** | Versionner le code | git-scm.com |
| **Node.js** (version LTS) | Faire tourner l'app Next.js, inclut `npm` | nodejs.org |
| **Docker Desktop** | Fait tourner Supabase en local (obligatoire) | docker.com/products/docker-desktop |
| **Supabase CLI** | Lance la base de données locale | supabase.com/docs/guides/local-development |
| **GitHub CLI (`gh`)** | Se connecter à GitHub et créer le dépôt | cli.github.com |
| **VS Code** | Éditeur de code | code.visualstudio.com |
| **Compte GitHub** | Héberger le dépôt | github.com |

Extensions VS Code utiles : ESLint, Prettier, Tailwind CSS IntelliSense, PostgreSQL (ou SQLTools).

### Installation sur Mac (la plus rapide : Homebrew)

Ouvre l'app **Terminal**, puis :

```bash
# 1. Homebrew (gestionnaire de paquets), si tu ne l'as pas
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
# Suis les 2 lignes "Next steps" affichées à la fin pour l'ajouter au PATH

# 2. Les outils
brew install git node gh supabase/tap/supabase
brew install --cask docker visual-studio-code
```

Puis ouvre **Docker** (Applications > Docker) une première fois et accepte les autorisations.
Mac Apple Silicon (M1 à M4) : tout est compatible.

Vérification (dans un terminal, chaque commande doit afficher une version) :

```bash
git --version
node --version
npm --version
docker --version
supabase --version
gh --version
```

> Docker Desktop doit être **ouvert et démarré** avant de lancer Supabase.
> Sur Mac, Docker Desktop doit rester ouvert tant que tu travailles.

## 2. Connexion à GitHub

```bash
# 1. Te connecter (suit les étapes dans le navigateur)
gh auth login

# 2. Dans le dossier du projet
cd french-track-prono
git init -b main
git add .
git commit -m "chore: conception initiale et schéma de base de données"

# 3. Créer le dépôt GitHub (privé au début) et pousser
gh repo create french-track-prono --private --source=. --remote=origin --push
```

Configurer ton identité Git une seule fois :

```bash
git config --global user.name "Prince"
git config --global user.email "ton-email-github"
```

### Méthode de travail Git (simple)
- `main` : toujours propre, ce qui marche.
- Une branche par issue : `feat/<n>-nom-court`, `fix/<n>-…`, `chore/<n>-…`, `docs/<n>-…`.
- Messages de commit courts, en anglais : `feat:`, `fix:`, `docs:`, `chore:`.
- Jamais de push sur `main` : une pull request par issue, fusionnée par toi (règles complètes dans `AGENTS.md`).

## 3. Lancer la base de données en local

```bash
cd french-track-prono
supabase start         # démarre la base (premier lancement : plusieurs minutes)
supabase db reset      # applique migrations + seed.sql
```

La configuration (`supabase/config.toml`) est déjà dans le dépôt : pas de `supabase init`.

### Rouvrir des épreuves pour tester les pronostics

Le tournoi de test est terminé : après un `supabase db reset`, toutes les épreuves sont
verrouillées. Pour pouvoir pronostiquer en local :

```bash
npm run db:open-events
```

Le script (`supabase/dev/open_events.sql`) décale tout le programme à partir de maintenant, dans le
même ordre : la première épreuve est déjà verrouillée, les 27 autres sont ouvertes sur trois
jours, et les résultats officiels sont retirés. Relance-le pour repartir de « maintenant ».
`supabase db reset` remet le vrai programme. Ce script ne sert qu'en local : il n'est ni dans les
migrations ni dans `seed.sql`.

Une fois démarré, `supabase start` affiche les adresses utiles :

| Service | Adresse habituelle |
|---|---|
| Studio (interface de la base) | http://localhost:54323 |
| API | http://127.0.0.1:54321 |
| Mailbox de test (liens magiques) | http://localhost:54324 |

La clé « Publishable » (ancienne clé `anon`) s'affiche aussi : elle va dans `.env.local`, jamais dans `.env.example`.

Contrôle rapide dans Studio : la table `events` doit contenir 28 lignes, `results` 91.

### Joueurs de démo pour vérifier les points

Après `npm run db:open-events`, la commande suivante crée douze joueurs inventés
(`demo-1@example.test` à `demo-12@example.test`, pseudos « Démo … ») avec des pronos sur les deux
premières épreuves ouvertes :

```
npm run db:demo-players
```

Elle peut être relancée : elle repart de zéro. Le haut du fichier `supabase/dev/demo_players.sql`
donne les points attendus si l'admin saisit le résultat a, b, c (l'ordre de la liste de départ) :
un podium parfait avec joker et coup de flair (28 points), un podium parfait simple (12), un joker
sur 5 points (10), etc. `supabase db reset` efface ces joueurs.

Pour vérifier les points en une seule commande (après `npm run db:open-events`) :

```
npm run db:test-points
```

Elle crée les joueurs de démo, affiche les athlètes des deux épreuves sous les lettres a, b, c,
puis verrouille ces deux épreuves. Il ne reste qu'à te mettre admin (« Devenir admin en local »),
à saisir a 1er, b 2e, c 3e dans `/admin` et à calculer les points.

### Voir l'app vivante en une commande (`db:demo-full`)

Pour explorer l'interface sans tout scripter à la main, après un `supabase db reset` :

```
npm run db:demo-full
```

Un seul coup et tu obtiens :

- le championnat Ultimate décalé pour straddle « maintenant » : **~12 épreuves terminées** (avec
  résultats et classement) et **~16 à venir** (prêtes à pronostiquer) ;
- les **12 joueurs de démo** (`demo-1@example.test` à `demo-12@example.test`) avec e-mail confirmé,
  prêts à se connecter par lien magique (tape l'e-mail sur `/connexion`, clique le lien dans
  Mailpit à http://127.0.0.1:54324) ;
- un prono par joueur et par épreuve (336 au total), avec joker sur la première ;
- des **points réels** sur les épreuves terminées (`score_events` et `predictions.points_awarded`
  remplis) — le classement, les stats de profil et la grille de badges s'allument ;
- la ligue de démo **« Démo Prono »** (publique, 12 membres, Démo Gazelle propriétaire) qui couvre
  le championnat ;
- la ligue Manager **« Démo Manager »** (mercato ouvert, 4 participants) et 8 athlètes déjà prisés
  dans le catalogue, pour tester le flux Manager de bout en bout.

Le script (`supabase/dev/demo_state.sql`) est idempotent : relance-le pour repartir d'un état
propre sur « maintenant ». Comme `db:open-events` et `db:demo-players`, il ne sert qu'en local.

## 4. Lancer l'application

```bash
npm install
cp .env.example .env.local     # puis remplir les deux variables ci-dessous
npm run dev                    # http://localhost:3000 ; la liste des épreuves est sur /competitions
```

Dans `.env.local` :

```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321      # en http, pas https
NEXT_PUBLIC_SUPABASE_ANON_KEY=<la clé « Publishable » affichée par supabase start>
```

Après toute modification de `.env.local`, redémarre `npm run dev`.

Pour les composants : `npm run storybook` (http://localhost:6006). Pour leurs tests, installe une
fois le navigateur : `npx playwright install chromium`, puis `npm run test:storybook`.

## Devenir admin en local

L'admin saisit les résultats et lance le calcul des points avec sa propre session : pas de clé
secrète dans l'application. On devient admin uniquement en SQL (un joueur ne peut pas se donner
ce droit depuis l'application).

1. Connecte-toi une fois sur `http://localhost:3000` et crée ton profil.
2. Dans le terminal (remplace le pseudo par le tien) :

```
docker exec -i supabase_db_french-track-prono psql -U postgres -c "update profiles set is_admin = true where lower(pseudo) = lower('MonPseudo')"
```

3. Recharge la page. `supabase db reset` efface ce droit : refais l'étape 2 après un reset.

Le back-office (`/admin/competitions`) regroupe : Compétitions (créer une compétition, ses épreuves
et ses engagés, puis les cotes de chaque épreuve), Athlètes, Disciplines (tolérances), Barème
(points du jeu, cotes et perfs compris), Ligues (ligues publiques signalées) et Historique. À la connexion, un admin arrive sur le
back-office ; « Voir le site » (bandeau rouge) ouvre le côté joueur, et « Back-office » (en-tête)
y ramène.

### Compétition de lancement : Championnats d'Europe (Birmingham)

Les Championnats d'Europe de Birmingham (10-16 août 2026) sont rejoués comme s'ils avaient lieu
du lundi 23 au dimanche 29 novembre 2026 (mêmes jours de la semaine, mêmes heures locales) :
46 finales, les finalistes comme liste de départ (les trois médaillés pour les concours et les
épreuves combinées), sans résultat.

```
npm run db:load-euro
```

Puis `COMPETITION_SLUG=european-championships-2026` dans `.env.local` et relance `npm run dev`.
Pour simuler la fin des épreuves, `npm run db:euro-results` charge les résultats officiels (ou
saisis-les dans `/admin`). Les sources sont citées en tête des fichiers `supabase/data/`.
En production, le même fichier se charge une fois dans l'éditeur SQL de Supabase.

### Choisir la compétition affichée

L'accueil liste les compétitions de la base (internationales et françaises). Les pages
« Compétitions », « Classement », « Mes points » et le back-office suivent la **prochaine compétition
par date** (celle en cours, sinon la prochaine à commencer ; toutes finies : la plus récente).
Une compétition se choisit aussi par son lien (`/competitions/<slug>`, `/competitions?competition=<slug>`, l'ancien `/epreuves?…` y redirige).
La variable `COMPETITION_SLUG` (côté serveur, `.env.local`) force une compétition : la CI s'en sert
pour épingler les tests de bout en bout sur l'Ultimate Championship. Le nom, la ville et les dates
viennent de la table `competitions` (back-office « Compétitions ») ; les horaires s'affichent
toujours en heure de Paris.

## 4 bis. Connexion : lien du message et téléphone

Le message de connexion contient un code à 6 chiffres et un lien. Le lien pointe vers
`site_url` (`supabase/config.toml`, `http://localhost:3000`, la même adresse que `npm run dev`) puis `/auth/callback`.
Il fonctionne dans n'importe quel navigateur (pas de cookie préalable nécessaire).
Redirections acceptées : `http://localhost:3000` et `http://127.0.0.1:3000`.
Ouvre toujours l'application sur `localhost` : les cookies de connexion sont propres à chaque
adresse, et un lien qui s'ouvre sur `127.0.0.1` te connecterait là, pas dans ton onglet `localhost`.

Pour tester l'application sur un téléphone (même Wi-Fi que le Mac) :

1. Trouve l'adresse locale du Mac : `ipconfig getifaddr en0` (exemple : `192.168.1.20`).
2. Lance `npm run dev -- -H 0.0.0.0` et ouvre `http://192.168.1.20:3000` sur le téléphone.
3. Connecte-toi avec le code à 6 chiffres (lu dans la boîte de test sur le Mac).

`next.config.ts` autorise les adresses du réseau local (192.168.x.x, 10.x.x.x, 172.x.x.x,
*.local) en développement : sans cela, Next.js bloque ses scripts pour toute autre adresse que
`localhost`, la page s'affiche mais rien ne réagit au toucher. Pour une autre adresse (tunnel,
nom de machine), ajoute-la dans `DEV_ALLOWED_ORIGINS` (séparées par des virgules) dans `.env.local`.

Pour tester le lien depuis un téléphone sur le même réseau :

1. Dans `supabase/config.toml`, mets l'adresse locale de ton Mac dans `site_url`
   (exemple : `http://192.168.1.20:3000`) et ajoute la même adresse à `additional_redirect_urls`.
2. `supabase stop` puis `supabase start` pour recharger la configuration (un `supabase db reset` ne la recharge pas).
3. Ne committe pas cette adresse : remets `http://localhost:3000` avant de créer ta PR.

Le code à 6 chiffres marche toujours, sans rien changer.

## 4 ter. Test de bout en bout (Playwright)

Les parcours sont testés avec Playwright (un fichier par parcours dans `e2e/`), dont « connexion →
profil → prono → épreuve verrouillée → résultat saisi par l'admin → points », « deux amis dans la
même ligue voient le même classement », « accueil → compétitions françaises → ligue sur deux
compétitions », le prono avec cotes et « Autre athlète », les perfs, et les écrans d'admin.
En CI, `COMPETITION_SLUG=ultimate-championship-2026` épingle les pages sur la compétition du seed :
les tests créent leurs propres compétitions et les suppriment ensuite.
Ils tournent sur le build de production, contre Supabase local. Ils lisent le code de connexion
dans la boîte de test (Mailpit) et préparent la base avec `psql` (verrouillage, droit admin,
points).

```
supabase start
npm run db:open-events
npx playwright install chromium
npm run build
npm run test:e2e
```

- Durée : moins d'une minute pour le test lui-même ; en CI, l'installation de Chromium et le
  build ajoutent environ 3 minutes au job « Database ».
- Pas de relance automatique : un test qui échoue est corrigé ou supprimé.
- En cas d'échec en CI, le rapport (traces, captures) est joint au run sous le nom
  `playwright-report`.
- Le test crée un joueur `e2e-…@example.test` à chaque passage ; `supabase db reset` remet tout à
  zéro.

## 4 quater. Migrations de la base en production

Le schéma de production suit le dépôt, jamais de modification à la main
(`.github/workflows/migrations.yml`) :

- **Tag `vX.Y.Z` poussé** : les migrations de `supabase/migrations` sont appliquées au projet
  Supabase de production (`supabase db push`), dans l'environnement GitHub `production`.
- **À la main** (onglet Actions > « Database migrations » > **Run workflow**) : applique les
  migrations de `main` sans nouveau tag, puis déploie `main`, par exemple après avoir corrigé un
  secret. Seuls `main` et les tags `v*` sont acceptés : une branche de travail est refusée.
- **PR qui touche `supabase/migrations`** : un essai à blanc (`--dry-run`) liste ce qui serait
  appliqué, sans rien changer.
- **Secrets** (GitHub > Settings > Secrets and variables > Actions) : `SUPABASE_ACCESS_TOKEN`,
  `SUPABASE_DB_PASSWORD`, `SUPABASE_PROJECT_REF`. Sans eux, la mise en prod échoue et rien
  n'est déployé : le code ne part jamais sans son schéma.
- **Une mise en prod à la fois**, dans l'ordre de lancement : deux tags poussés à la suite
  s'attendent.

**Migrations rétrocompatibles.** Les migrations sont appliquées une à deux minutes avant que le
nouveau code soit en ligne, et le code en prod reste l'ancien si le déploiement échoue. Une
migration doit donc marcher avec la version déjà en prod :

- ajouter (table, colonne avec valeur par défaut ou nullable, fonction) : sans risque ;
- renommer ou supprimer une colonne, une table, une fonction, ou changer sa signature : en deux
  versions. D'abord ajouter le nouveau et faire passer le code dessus (tag), puis retirer l'ancien
  dans une version suivante.

**Retour arrière.** Une migration appliquée n'est jamais modifiée ni supprimée : on écrit une
nouvelle migration qui défait la précédente, on la fait passer par une PR, puis on pose un tag de
correctif (`vX.Y.Z+1`). En cas de casse grave, la restauration se fait depuis la sauvegarde
quotidienne du projet Supabase (tableau de bord > Database > Backups), puis on réapplique les
migrations voulues avec un tag.

## Dépendances : les « overrides » de package.json

`package.json` force deux versions de dépendances indirectes : `minimatch` sous
`@typescript-eslint/typescript-estree` et `glob` sous
`@joshwooding/vite-plugin-react-docgen-typescript`. Elles corrigent des failles signalées par
`npm audit` dans des versions anciennes de ces paquets. On peut les retirer quand `npm audit` ne
signale plus rien sans elles (test : les supprimer, `npm install`, `npm audit`).

## Déploiements Vercel

La production suit les **tags de version**, pas `main` (#405) : pousser un tag `vX.Y.Z` lance le
workflow « Database migrations » (`.github/workflows/migrations.yml`), qui applique d'abord les
migrations au projet Supabase de prod, puis construit et déploie ce commit sur Vercel en
production (`vercel pull`, `vercel build --prod`, `vercel deploy --prebuilt --prod`), et enfin
lance le test de fumée. Le code ne tourne donc jamais en prod avant son schéma.

- Aucun push ne déploie (`vercel.json`, `git.deploymentEnabled: false`) : ni `main`, ni les
  branches de travail (`feat/`, `fix/`, `claude/`…), ni la branche `boards`. Le plan
  gratuit limite le nombre de déploiements par jour : le 9 novembre 2026, les prévisualisations de
  chaque PR l'ont épuisé et la mise en prod de #373 a été refusée (« Deployment rate limited »).
- Redéployer `main` à la main : onglet Actions → « Database migrations » → Run workflow.
- Secrets de l'environnement GitHub `production` (Settings → Environments → production), en plus
  de ceux de Supabase :

| Secret | Où le trouver |
|---|---|
| `VERCEL_TOKEN` | Vercel → Account Settings → Tokens, portée limitée à l'équipe du projet |
| `VERCEL_ORG_ID` | Vercel → Team Settings → General → Team ID (`orgId` dans `.vercel/project.json` après `vercel link`) |
| `VERCEL_PROJECT_ID` | Vercel → Project Settings → General → Project ID |

Sans ces trois secrets, le job de déploiement échoue (exprès : la prod ne doit pas rester figée
sans qu'on le voie). Les variables d'environnement de l'application restent dans Vercel ;
`vercel pull` les récupère pour le build.

Le déploiement passe par `ci/vercel-deploy.sh <adresse>` (#720), appelé par le job « Deploy to
Vercel production » de `migrations.yml` et par le job de déploiement de `preprod.yml` (#634), qui
y ajoute `NEXT_PUBLIC_SITE_NOINDEX=1` avec `VERCEL_EXTRA_ENV` :

1. **Vérification avant le build** : après `vercel pull`, l'environnement de production du projet
   Vercel doit contenir `NEXT_PUBLIC_SUPABASE_URL` et `NEXT_PUBLIC_SUPABASE_ANON_KEY`, non vides.
   Sinon le job s'arrête en rouge avant le build, sans rien déployer, et donne le **nom** des
   variables manquantes (jamais leur valeur). Le 13 novembre 2026 (v0.17.0), elles avaient disparu
   du projet Vercel avec l'intégration Supabase du Marketplace : le build passait et toutes les
   pages répondaient 500. Correctif : les remettre (Vercel → Settings → Environment Variables,
   environnement Production), puis relancer le job.
2. **Déploiement en deux temps** : `vercel deploy --prebuilt --prod --skip-domain`, puis
   `vercel promote` qui branche ce déploiement sur les domaines (et lève un éventuel retour
   arrière précédent, sinon les déploiements suivants ne seraient plus servis).
3. **Retour arrière automatique** : si le test de fumée échoue, `vercel rollback` remet le
   déploiement précédent, le job reste rouge et une issue `bug` + `needs-human` « Déploiement
   annulé… » mentionne les propriétaires (`AGENTS_OWNER`) avec le lien du job. Après correction,
   relancer le workflow : le `promote` du nouveau déploiement rebranche les domaines.

## Préproduction

Chaque fusion dans `main` est en ligne avant la prod (#634, décision du propriétaire du 13 nov. 2026).

- **Adresse** : https://french-track-preprod.vercel.app, publique pour l'instant, cachée aux
  moteurs de recherche (`NEXT_PUBLIC_SITE_NOINDEX=1` au build : balise `noindex` et
  `robots.txt` qui interdit tout).
- **Projets séparés** : projet Supabase `french-track-preprod`, projet Vercel
  `french-track-preprod` (équipe `frenchtrackprono`), environnement GitHub `preprod`. Aucun
  secret ni aucune donnée de prod : la base de préprod ne contient que des données fictives.
- **Déploiement continu** : chaque fusion dans `main` lance « Pre-production »
  (`.github/workflows/preprod.yml`) : migrations sur la base de préprod (`supabase db push`), puis
  `supabase/seed.sql` (idempotent), puis build et déploiement Vercel, puis test de fumée sur
  l'adresse de préprod. Une migration qui échoue arrête tout : le site de préprod n'est pas
  déployé, la prod n'est jamais touchée. À la main : Actions → « Pre-production » → Run workflow
  (seulement `main`).
- **Garde-fou** : le workflow refuse un `SUPABASE_PROJECT_REF` qui n'est pas celui de la préprod
  (un secret de prod collé par erreur).
- **Pas de remise à zéro** : ce que le propriétaire crée à la main en préprod reste d'un
  déploiement à l'autre.
- **À venir** : le jeu de démo propre à la préprod (#694) et les tests e2e lancés contre la
  préprod après chaque déploiement (#695).
- **Pas de captcha ni de notifications push** en préprod (pas de clé Turnstile ni VAPID).
- **Mise en prod** : la prod suit toujours les tags, posés automatiquement quand un milestone est
  fini et `main` vert, sans feu vert humain (décision du propriétaire du 13 nov. 2026,
  `ci/agents/README.md`, étape 6). Seul garde-fou : un run « Pre-production » en échec sur le
  commit de `main` fait attendre le tag jusqu'au passage suivant.

Secrets de l'environnement GitHub `preprod` (Settings → Environments → preprod), ceux du projet
de préprod, jamais ceux de la prod : `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`,
`SUPABASE_PROJECT_REF`, `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`. Les variables de
l'application (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`NEXT_PUBLIC_SITE_URL`, `SUPABASE_SERVICE_ROLE_KEY`) vivent dans le projet Vercel de préprod.

## Test de la prod après déploiement

Le workflow « Production smoke test » (`.github/workflows/smoke.yml`, script `scripts/smoke.sh`)
ouvre l'accueil, les épreuves, une page d'épreuve, « Comment jouer », la connexion et les mentions
légales de www.frenchtrackprono.com : après chaque déploiement de production (lancé aussi en fin
de workflow de déploiement, #405), chaque jour à 6 h 17 (heure de Paris en hiver, ce qui repère aussi un projet Supabase en pause) et à la
demande (onglet Actions → Run workflow). Pas de relance : un échec est signalé par e-mail.
Pour l'essayer ailleurs : `scripts/smoke.sh http://localhost:3000`.

## Réglages Auth de la prod (Supabase, à la main)

Le fichier `supabase/config.toml` ne règle que le Supabase local. En prod (Authentication) :

| Où | Réglage |
|---|---|
| Sign In / Providers → Email | « Confirm email » désactivé ; « Secure email change » **désactivé** (le code va seulement à la nouvelle adresse) ; OTP valable 600 s |
| Emails → Templates → Magic Link et Confirm signup | contenu de `supabase/templates/sign_in.html` |
| Attack Protection → Captcha | Turnstile activé avec la **clé secrète** du widget Cloudflare ; la clé publique va dans Vercel (`NEXT_PUBLIC_TURNSTILE_SITE_KEY`, #331). Sans clé publique, la page de connexion n'affiche pas de captcha (local, CI). **Ordre** : clé publique dans Vercel et redéploiement d'abord, captcha Supabase ensuite (sinon plus personne ne reçoit de code) |
| Emails → Templates → Change Email Address | sujet « Confirme ta nouvelle adresse French Track Prono », contenu de `supabase/templates/email_change.html` |

## Comptes inactifs (2 ans)

Le workflow « Inactive accounts » (chaque nuit, ou à la main) prévient par e-mail les joueurs
sans activité (connexion, prono ou réaction) depuis 23 mois, puis supprime à 24 mois ceux qui
n'ont rien fait depuis l'e-mail (au moins 3 semaines après), comme « Supprimer mon compte ».
Règles : migration `20261109030000_inactive_accounts.sql` (testées en pgTAP). Secrets en plus de
ceux des migrations : `RESEND_API_KEY` et `RESEND_FROM` (environnement « production »). Sans eux,
personne n'est prévenu, donc personne n'est supprimé.

## Tours d'enchères du Manager

Le workflow « Manager rounds » (toutes les 5 minutes, ou à la main) clôt les tours d'enchères
du mercato French Track Manager dont l'heure est passée et attribue les athlètes (règles dans
`supabase/migrations/20261111170000_manager_awards.sql`). Il rejoue sans double attribution. Pas
de secret en plus de ceux des migrations (`SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF`).

## Notifications push

Les joueurs qui les ont activées depuis leur profil reçoivent un rappel avant le verrouillage
d'une finale qu'ils n'ont pas pronostiquée (dans les 20 minutes avant), et leurs points une fois
calculés (règles dans `supabase/migrations/20261109100000_push_notifications.sql`).

L'envoi tourne dans Supabase (#502) : chaque minute, `pg_cron` appelle l'Edge Function
`push-notifications` (`supabase/functions/`), qui envoie ce qui est dû. La logique d'envoi est
dans `supabase/functions/_shared/push.mjs`, partagée avec le workflow « Push notifications »,
qui ne se lance plus qu'à la main (une tâche planifiée de GitHub part en retard, ou pas du tout).

Mise en route, une seule fois :

1. Générer une paire de clés : `npx web-push generate-vapid-keys`.
2. GitHub, environnement « production » : secrets `VAPID_PUBLIC_KEY` et `VAPID_PRIVATE_KEY`.
3. Vercel, variables d'environnement de production : `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (la clé
   publique seulement).
4. Poser un tag (une version) : le workflow « Database migrations », après les migrations, déploie
   l'Edge Function, lui donne ses secrets (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` et un
   `PUSH_CRON_SECRET` tiré au hasard à chaque version), puis écrit dans Supabase Vault l'adresse
   de la fonction et ce même secret (`private.push_set_secrets`). Sans les clés VAPID, rien n'est
   déployé et `pg_cron` n'appelle rien. Sans `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, le bouton
   n'apparaît pas.
5. Facultatif (#527) : GitHub, environnement « production », secret `SENTRY_DSN` = le DSN du
   projet Sentry (le même que `NEXT_PUBLIC_SENTRY_DSN`, `docs/sentry.md`). Le workflow le donne à
   l'Edge Function avec ses autres secrets ; un passage en échec (exception, ou envois refusés
   autrement que par 404/410) arrive alors dans Sentry. Sans lui, la fonction marche pareil et ne
   signale rien.

Vérifier : Supabase > Integrations > Cron, tâche `push-notifications` (un passage par minute) ;
Edge Functions > `push-notifications` > Logs (« n notification(s) envoyée(s) »). Une réponse 401
veut dire que le secret de la fonction et celui de Vault diffèrent : reposer un tag les réaligne.

La clé privée ne va jamais dans Vercel ni dans le dépôt ; aucun secret dans une migration. Sur iPhone, les notifications ne
marchent qu'une fois l'appli ajoutée à l'écran d'accueil (iOS 16.4 ou plus).
## Sentry (erreurs en prod)

Optionnel : voir `docs/sentry.md` (compte UE, `NEXT_PUBLIC_SENTRY_DSN` dans Vercel, jeton pour
les source maps dans l'environnement GitHub « production »).

## Import des clubs d'athlétisme

Le workflow « Clubs import » (le 2 de chaque mois, ou à la main depuis l'onglet Actions) lit les
clubs sportifs actifs de l'API Recherche d'entreprises (`scripts/clubs/fetch.mjs`), écarte les
autres sports et remet les noms en forme (`scripts/clubs/import.mjs`, règles dans
`src/domain/club.ts`), puis les envoie à `import_clubs()` en prod par l'API de gestion Supabase
(mêmes secrets que les migrations). Un club = un SIREN : relancer ne crée pas de doublon.
Les fichiers produits restent en artefact « clubs » pour vérification.

## 5. Sécurité : à ne jamais committer

- `.env.local` et tout fichier contenant des clés (déjà dans `.gitignore`)
- La clé `service_role` : uniquement côté serveur, jamais dans le navigateur

## 6. Plus tard (pas maintenant)

- Vercel (hébergement) et un projet Supabase cloud
- Nom de domaine
- Sauvegardes et suivi d'erreurs
