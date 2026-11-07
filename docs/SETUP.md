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

## 4. Lancer l'application

```bash
npm install
cp .env.example .env.local     # puis remplir les deux variables ci-dessous
npm run dev                    # http://localhost:3000 ; la liste des épreuves est sur /epreuves
```

Dans `.env.local` :

```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321      # en http, pas https
NEXT_PUBLIC_SUPABASE_ANON_KEY=<la clé « Publishable » affichée par supabase start>
```

Après toute modification de `.env.local`, redémarre `npm run dev`.

Pour les composants : `npm run storybook` (http://localhost:6006). Pour leurs tests, installe une
fois le navigateur : `npx playwright install chromium`, puis `npm run test:storybook`.

## 4 bis. Connexion : lien du message et téléphone

Le message de connexion contient un code à 6 chiffres et un lien. Le lien pointe vers
`site_url` (`supabase/config.toml`, `http://localhost:3000`, la même adresse que `npm run dev`) puis `/auth/callback`.
Il fonctionne dans n'importe quel navigateur (pas de cookie préalable nécessaire).
Redirections acceptées : `http://localhost:3000` et `http://127.0.0.1:3000`.
Ouvre toujours l'application sur `localhost` : les cookies de connexion sont propres à chaque
adresse, et un lien qui s'ouvre sur `127.0.0.1` te connecterait là, pas dans ton onglet `localhost`.

Pour tester le lien depuis un téléphone sur le même réseau :

1. Dans `supabase/config.toml`, mets l'adresse locale de ton Mac dans `site_url`
   (exemple : `http://192.168.1.20:3000`) et ajoute la même adresse à `additional_redirect_urls`.
2. `supabase stop` puis `supabase start` pour recharger la configuration (un `supabase db reset` ne la recharge pas).
3. Ne committe pas cette adresse : remets `http://localhost:3000` avant de créer ta PR.

Le code à 6 chiffres marche toujours, sans rien changer.

## 5. Sécurité : à ne jamais committer

- `.env.local` et tout fichier contenant des clés (déjà dans `.gitignore`)
- La clé `service_role` : uniquement côté serveur, jamais dans le navigateur

## 6. Plus tard (pas maintenant)

- Vercel (hébergement) et un projet Supabase cloud
- Nom de domaine
- Sauvegardes et suivi d'erreurs
