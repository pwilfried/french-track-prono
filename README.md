# 🏃 French Track Prono (MPP athlétisme)

Un « Mon Petit Prono » pour l'athlétisme : on pronostique les podiums des épreuves, on se
challenge entre amis dans des ligues privées, et un classement départage tout le monde.
Projet lié au podcast **FrenchTrack**.

## Où on en est

| | |
|---|---|
| Version en cours | **v0.2 Comptes** : connexion par code ou lien reçu par e-mail, profil (pseudo, avatar, 15 ans ou plus). Terminé : v0.1 (liste des 28 épreuves de l'Ultimate Championship 2026 et podium officiel) |
| Compétition de test | World Athletics Ultimate Championship, Budapest, 11-13 sept. 2026 |
| Mode de travail | Une issue = une branche = une pull request, tests d'abord, test en local avant de fusionner (règles dans [AGENTS.md](AGENTS.md)) |
| Prochaines versions | v0.3 pronostics, v0.4 back-office et points, v0.5 ligues et classements, v0.6 suspense, v0.7 mise en ligne (voir [docs/ROADMAP.md](docs/ROADMAP.md)) |

## Stack

- **Front + serveur** : Next.js (App Router) + TypeScript, Node 24
- **UI** : Tailwind CSS v4 + composants façon shadcn/ui, mode sombre, Storybook pour podium, classement et compte à rebours
- **Base de données + comptes** : Supabase (PostgreSQL, Auth, Row Level Security), en local via Docker
- **Tests** : Vitest (domaine, cas d'usage, adaptateurs), pgTAP (base), Storybook + Vitest (composants)
- **CI** : GitHub Actions sur chaque pull request
- **Hébergement (plus tard)** : Vercel + Supabase cloud

## Documents

| Fichier | Contenu |
|---|---|
| [AGENTS.md](AGENTS.md) | Règles du projet (Git, TDD, couches, interface) |
| [docs/architecture.md](docs/architecture.md) | Vision, stack, couches, versions, cas de test |
| [docs/CONCEPTION.md](docs/CONCEPTION.md) | Règles du jeu, barème, modèle de données |
| [docs/DESIGN.md](docs/DESIGN.md) | Identité visuelle, palette, composants |
| [docs/SETUP.md](docs/SETUP.md) | Outils à installer, connexion GitHub |
| [docs/ROADMAP.md](docs/ROADMAP.md) | Versions, avec critères de réussite |

## Démarrage rapide

Prérequis : Node 24 (`.nvmrc`), Docker (qui doit tourner), la CLI Supabase. Détails dans [docs/SETUP.md](docs/SETUP.md).

```bash
npm install
supabase start        # base locale ; affiche l'adresse de l'API et la clé « Publishable »
supabase db reset     # applique le schéma et les données de test
cp .env.example .env.local
```

Dans `.env.local`, renseigne `NEXT_PUBLIC_SUPABASE_URL` (en local : `http://127.0.0.1:54321`, en `http`)
et `NEXT_PUBLIC_SUPABASE_ANON_KEY` (la clé « Publishable » de `supabase status`). Ne mets aucune clé
dans `.env.example`.

```bash
npm run dev           # http://localhost:3000, la liste des épreuves est sur /competitions
```

Autres commandes : `npm test`, `npm run lint`, `npm run typecheck`, `npm run build`,
`npm run storybook` (http://localhost:6006), `npm run test:storybook` (première fois :
`npx playwright install chromium`), `supabase test db`.

## Structure

```
french-track-prono/
├─ docs/                  conception, architecture, design
├─ supabase/
│  ├─ migrations/         schéma SQL versionné
│  ├─ seed.sql            données de test (Ultimate Championship 2026)
│  └─ tests/              tests pgTAP
├─ src/
│  ├─ domain/             règles pures
│  ├─ application/        cas d'usage et ports
│  ├─ infra/              Supabase (réel) et versions en mémoire pour les tests
│  ├─ app/                pages Next.js et textes (messages.fr.ts)
│  └─ components/         composants d'interface
├─ .storybook/            configuration Storybook
├─ .env.example           modèle des variables d'environnement
└─ AGENTS.md              règles pour tous les agents
```
