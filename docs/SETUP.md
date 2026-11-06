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
- Une branche par itération : `iteration-0-socle`, `iteration-1-lecture`...
- Messages de commit courts : `feat:`, `fix:`, `docs:`, `chore:`.
- Fin d'itération : pull request sur GitHub, puis fusion dans `main`.

## 3. Lancer la base de données en local

```bash
cd french-track-prono
supabase init          # une seule fois (crée supabase/config.toml)
supabase start         # démarre la base (premier lancement : plusieurs minutes)
supabase db reset      # applique migrations + seed.sql
```

`supabase init` peut demander de ne pas écraser des fichiers : garde `migrations/` et `seed.sql`.

Une fois démarré, `supabase start` affiche les adresses utiles :

| Service | Adresse habituelle |
|---|---|
| Studio (interface de la base) | http://localhost:54323 |
| API | http://127.0.0.1:54321 |
| Mailbox de test (liens magiques) | http://localhost:54324 |

Les clés `anon` et `service_role` s'affichent aussi : elles vont dans `.env.local` (voir `.env.example`).

Contrôle rapide dans Studio : la table `events` doit contenir 28 lignes, `results` 91.

## 4. Lancer l'application (à partir de l'itération 0)

```bash
npm install
cp .env.example .env.local     # puis coller les clés Supabase
npm run dev                    # http://localhost:3000
```

## 5. Sécurité : à ne jamais committer

- `.env.local` et tout fichier contenant des clés (déjà dans `.gitignore`)
- La clé `service_role` : uniquement côté serveur, jamais dans le navigateur

## 6. Plus tard (pas maintenant)

- Vercel (hébergement) et un projet Supabase cloud
- Nom de domaine
- Sauvegardes et suivi d'erreurs
