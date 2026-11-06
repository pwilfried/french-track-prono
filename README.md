# 🏃 French Track Prono (MPP athlétisme)

Un « Mon Petit Prono » pour l'athlétisme : on pronostique les podiums des épreuves, on se
challenge entre amis dans des ligues privées, et un classement départage tout le monde.
Projet lié au podcast **FrenchTrack**.

## Où on en est

| | |
|---|---|
| Phase | Conception terminée, **aucun code applicatif encore** |
| Compétition de test | World Athletics Ultimate Championship, Budapest, 11-13 sept. 2026 |
| Mode de travail | Itérations courtes, test en local d'abord |
| Base de données | Schéma + données de test prêts (`supabase/`) |

## Stack

- **Front + API** : Next.js (App Router) + TypeScript
- **UI** : Tailwind CSS + shadcn/ui, animations Framer Motion, glisser-déposer dnd-kit, confettis
- **Base de données + comptes** : Supabase (PostgreSQL, Auth, Row Level Security), en local via Docker
- **Hébergement (plus tard)** : Vercel + Supabase cloud

## Documents

| Fichier | Contenu |
|---|---|
| [docs/CONCEPTION.md](docs/CONCEPTION.md) | Vision, règles du jeu, barème, architecture, modèle de données |
| [docs/DESIGN.md](docs/DESIGN.md) | Identité visuelle, écrans, composants, ton « fun » |
| [docs/SETUP.md](docs/SETUP.md) | Outils à installer, connexion GitHub, lancement en local |
| [docs/ROADMAP.md](docs/ROADMAP.md) | Itérations, avec critères de réussite |

## Démarrage rapide (une fois les outils installés, voir SETUP)

```bash
supabase start        # base locale (Docker doit tourner)
supabase db reset     # applique le schéma + les données de test
# puis, dès l'itération 0 : npm run dev  ->  http://localhost:3000
```

## Structure prévue

```
french-track-prono/
├─ docs/                  documents de conception
├─ supabase/
│  ├─ migrations/         schéma SQL versionné
│  └─ seed.sql            données de test (Ultimate Championship 2026)
├─ src/                   application Next.js (à partir de l'itération 0)
├─ .env.example           variables d'environnement (à copier en .env.local)
└─ README.md
```
