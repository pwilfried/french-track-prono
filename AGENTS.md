# AGENTS.md — règles pour tous les agents

Source unique des règles du projet. `CLAUDE.md` contient seulement `@AGENTS.md`.
Langue : docs du dépôt en français ; code, noms, commentaires de code, messages de commit et
titres de PR en anglais. Dialogue avec le propriétaire en français.

## Read first

1. `docs/architecture.md` : vision, non-objectifs, stack, couches, versions, cas de test.
2. `docs/DESIGN.md` : palette, typographie, composants.
3. La version (milestone) en cours et son critère « It works when… ».
4. Ce fichier.

## House rules

- Ne construis que ce que la version en cours demande. Le reste va dans une issue.
- Quand le propriétaire soulève une idée ou un bug pendant que tu travailles sur autre chose :
  ouvre une issue, donne son numéro en une ligne, continue ce que tu faisais.
- Pas de données personnelles ni de vrais noms dans le dépôt, les fixtures ou les captures.
  Les données de test réelles vivent hors du dépôt (voir « Données de test »).
- Aucun secret dans le dépôt. La clé `service_role` reste côté serveur.
- Un port n'existe que s'il a deux implémentations (réelle + fake). Pas d'abstraction « au cas où ».
- Les erreurs sont des codes énumérés, jamais des phrases ; les textes français vivent dans le
  fichier de messages de l'interface.
- Pas d'argent, pas de photos d'athlètes, pas de chat libre (voir non-objectifs).

## Git and PRs

- **Jamais de push sur `main`.** Tout passe par une branche et une pull request. Le hook
  `.githooks/pre-push` refuse les pushes vers `main` (`git config core.hooksPath .githooks`).
- Pas de force-push. Pas de rebase. Si la PR est en conflit, on fusionne `main` dans la branche
  (`git merge origin/main`), seulement dans ce cas.
- Une branche par issue : `feat/<n>-short-name`, `fix/<n>-short-name`, `chore/<n>-short-name`.
- Messages de commit courts, en anglais, au présent : `feat: add podium picker`.
  **Pas de trailer `Co-Authored-By`** dans les commits.
- Une PR = une issue, petite, avec `Closes #<n>`. Description : ce qui change, comment le vérifier.
- Une PR d'agent (branche `claude/…`) est fusionnée par `agents-merge` sur une CI verte (voir
  « Agents on GitHub ») ; les autres PR sont fusionnées par le propriétaire ou à sa demande.

## From issue to release

1. Une issue appartient à un milestone (une version) et porte des labels (type, zone, priorité).
2. Le propriétaire met `agent:ready` ; la chaîne la donne à Claude, qui ouvre une branche et
   applique le TDD (voir plus bas).
3. Avant de dire « terminé » : voir « Before saying it is done ».
4. PR → CI verte → fusion (automatique pour les PR d'agents).
5. Quand toutes les issues d'un milestone sont fermées : issues `refactor-check` et `docs-check`
   traitées, critère « It works when… » vérifié à la main, puis tag `vX.Y.Z` posé par le propriétaire.
   Le tag met la version en prod : migrations, puis déploiement Vercel (`docs/SETUP.md`).

## Screenshots in PRs

Toute PR qui change l'interface contient une capture mobile (390 px) et une capture en mode
sombre. Pas de données personnelles dans les captures. Les captures vivent sur la branche
orpheline `boards` (`boards/<issue>/*.png`) et sont liées dans la description de la PR. Le
workflow `ui-shots` capture en plus les pages touchées par chaque PR (`boards/issue-<n>/shots/`)
et les montre dans un commentaire tenu à jour ; un agent n'en produit pas d'autre, et l'issue
« Check the UI of #n » ouverte après la fusion reste la vérification humaine.

## Issues and milestones

- Un milestone par version (`vX.Y …`). Sa description est le critère « It works when… ».
- Chaque milestone contient trois issues de pilotage : `milestone-plan` (découper la version),
  `refactor-check` (revue des doublons et du code mort), `docs-check` (docs à jour).
- Labels : type (`feature`, `bug`, `chore`, `docs`, `spike`), zone (`zone:domain`,
  `zone:application`, `zone:infra`, `zone:app`, `zone:db`, `zone:ci`), composant métier
  (`c:scoring`, `c:predictions`, `c:leagues`, `c:leaderboard`, `c:auth`, `c:admin`),
  priorité (`p1`, `p2`, `p3`), agents (`agent:ready`, `agent:blocked`, `needs-human`),
  et `after-ui` (à faire une fois la maquette validée).
- Une issue : un titre court, le « pourquoi », des critères d'acceptation testables.
- Un `spike` a un délai et se termine par une décision écrite dans `docs/`.

## Architecture

Voir `docs/architecture.md`, section « Couches ». En bref :

```
src/domain/        règles pures (scoring, verrouillage, compte à rebours)
src/application/   un cas d'usage = un fichier : ports + execute()
src/infra/         Supabase (réel) + fakes en mémoire
src/app/           pages Next.js fines
supabase/          migrations, seed, tests pgTAP (verrouillage, sécurité)
```

`domain` n'importe rien ; `application` n'importe que `domain` ; `infra` implémente les ports ;
`app` assemble. La règle d'import est vérifiée en CI. Le calcul des points vit dans
`src/domain/scoring.ts` (décision B).

## UI rules

- Mobile d'abord (390 px), puis adaptation desktop. Cibles tactiles ≥ 44 px, contrastes AA.
- Palette et typographie : `docs/DESIGN.md`. Mode sombre obligatoire.
- Animations courtes, `prefers-reduced-motion` respecté.
- Composants Storybook : ceux du design system « Officiel » (podium, classement, compte à rebours,
  étiquettes de statut, carte d'épreuve, marque) ; pas les pages. Chaque état : vide, chargement,
  erreur, texte long.
- Les maquettes (« boards ») vivent sur la branche orpheline `boards`, jamais sur `main` ;
  une PR d'interface les référence par lien. Une issue `after-ui` attend la maquette validée.

## i18n

Français seul en v1. Tous les textes visibles sont dans un seul fichier de messages
(`src/app/messages.fr.ts`). Pas de bibliothèque d'i18n, pas de texte en dur dans les composants.

## CI

Sur chaque PR (runners GitHub, pas de machine dédiée) : formatage, lint, types, règle d'import
des couches, tests Vitest, tests pgTAP (Supabase local), build, puis Storybook (tests des
play functions dans Chromium et build). Le job base de données lance aussi les tests Playwright
de bout en bout (`e2e/`) sur le build, contre Supabase local, sans relance automatique. Une PR
n'est mergeable que si tout est vert, tests de bout en bout compris. Un test instable est corrigé
ou supprimé dans la semaine, jamais relancé automatiquement.

## Agents on GitHub

Claude Code tourne sur les issues et les PR depuis GitHub Actions (`agents.yml`,
`agents-merge.yml`, scripts dans `ci/agents/`). Mise en place et pilotage depuis le téléphone :
`ci/agents/README.md`. En bref :

- Seuls les propriétaires (variable `AGENTS_OWNER`) déclenchent : label `agent:ready` (la chaîne
  la prend), label `agent:claude` (tout de suite), ou commentaire `@claude …`.
- Deux issues à la fois (`AGENTS_CLAUDE_SLOTS`), dans le milestone en cours : `milestone-plan`,
  puis les features (`p1` d'abord), puis `refactor-check`, puis `docs-check`. Jamais une issue
  `needs-human`, `agent:blocked`, `after-ui`, ou bloquée par une issue ouverte.
- PR verte : fusionnée. Rouge ou en conflit : renvoyée à Claude, 3 fois, puis au propriétaire.
- Pas de tag automatique : la mise en prod reste au propriétaire.

Quand tu tournes là-bas :

- Travaille sur la branche donnée, dans le périmètre de l'issue. Avant de pousser :
  `npm run format`, `npm run lint`, `npm run typecheck`, `npm test`. Pas de Supabase local sur
  le runner : pgTAP, adaptateurs et e2e tournent dans la CI de la PR ; écris-les quand même.
- Si une décision du propriétaire manque, ne change rien et termine ton message final par une
  ligne `NEEDS-ANSWER: <la question, en français>`.
- Termine par un résumé court en français : ce qui change, quel test est venu d'abord, ce que
  l'étape de refactor a rangé, ce qui est passé, ce qui n'est pas vérifié.

## Planning a milestone

Quand on ouvre un milestone : l'issue `milestone-plan` découpe la version en issues petites
(une PR chacune), chaque issue avec ses critères d'acceptation testables et ses labels. On
construit d'abord le plus petit parcours bout en bout, puis on enrichit. Le plan est validé par
le propriétaire avant que des issues passent en `agent:ready`.

## Commands

Disponibles : `npm run dev`, `npm run build`, `npm run start`, `npm run lint`,
`npm run typecheck`, `npm test` (Vitest, dont la règle d'import des couches),
`npm run test:watch`, `npm run format` (écrit), `npm run format:check` (vérifie),
`npm run storybook` (composants), `npm run test:storybook` (play functions, navigateur Chromium),
`npm run build-storybook`, `npm run test:e2e` (Playwright, Supabase local + `npm run build`),
`supabase start`, `supabase db reset`, `supabase test db` (pgTAP),
`npm run db:open-events`, `npm run db:demo-players`, `npm run db:test-points`,
`npm run db:load-euro` et `npm run db:euro-results` (données de test locales, voir `docs/SETUP.md`).

Prérequis : Node 24 (`.nvmrc`), Docker pour Supabase local. Variables : copier `.env.example`
en `.env.local`.

## Before saying it is done

1. Les tests de la couche touchée passent (ou, si la machine est chargée : formatage seulement,
   et le dire).
2. Le critère de l'issue est vérifié, pas supposé.
3. L'étape de refactor est faite : doublons fusionnés, code mort retiré.
4. Docs mises à jour si une règle ou une décision a changé.
5. Aucun secret, aucune donnée réelle, aucun fichier inutile dans le diff.
6. Capture jointe si l'interface a changé.
7. Si la PR change un parcours (page, formulaire, redirection), le test de bout en bout (`e2e/`)
   est complété ou mis à jour dans la même PR, et la CI est verte, bout en bout compris.

## TDD

Les agents suivent ce tableau sans qu'on le leur demande.

| Où | Comment tester | Outil |
|---|---|---|
| Cœur pur (`src/domain`) | Rouge → vert → refactor, strictement. Les cas viennent de « Cas de test du cœur » dans `docs/architecture.md` (dont le barème, S1 à S13) | Vitest |
| Cas d'usage (`src/application`) | Outside-in, en partant du critère « It works when… » de la version. Un test nommé comme une phrase, structuré given / when / then, avec des fakes | Vitest + fakes en mémoire |
| Ports | Un test de contrat générique, exécuté contre le fake **et** contre l'adaptateur réel (Supabase local) | Vitest |
| Adaptateurs (`src/infra`) | Contre le vrai outil : base Supabase locale, données dans une transaction annulée ou un schéma temporaire | Vitest + Supabase local |
| Base de données (`supabase/`) | Verrouillage et sécurité par ligne testés en SQL, cas R1 à R9 | pgTAP (`supabase test db`) |
| Interface | Story d'abord. Chaque état : vide, chargement, erreur, texte long. Des play functions vérifient le comportement | Storybook + Vitest |
| Bug | Un test qui le reproduit **au plus bas niveau possible**, écrit avant le correctif | selon la couche |
| Invariants | Property tests : un score est toujours entre 0 et 28 ; l'ordre d'arrivée des pronos ne change pas le classement ; relancer le calcul ne change rien | Vitest + fast-check |
| Sorties texte | Snapshots, seulement pour des textes générés qui doivent rester stables | Vitest |
| Parcours principal | Tests de bout en bout dans `e2e/` : inscription → prono → résultat saisi → points, et deux amis dans une ligue → même classement. Lancés sur chaque PR ; toute PR qui change un parcours les complète | Playwright |

Règles complémentaires :

- Les noms de tests sont des phrases en anglais : `rejects a prediction after the lock time`.
- Composants Storybook : ceux du design system (voir « UI rules »). Les écrans complets sont
  couverts par les tests de bout en bout.
- Un test instable est corrigé ou supprimé dans la semaine, **jamais relancé automatiquement**.
- Chaque PR se termine par son étape de refactor : doublons fusionnés, code mort retiré,
  comportement inchangé (et tests toujours verts).
- Les agents ne lancent pas les suites complètes en local si la machine est chargée : formatage
  seulement, la CI vérifie.

## Données de test

- **Dans le dépôt** : le jeu de données public de l'Ultimate Championship 2026 (`supabase/seed.sql`),
  plus des joueurs fictifs (pseudos inventés, e-mails en `@example.test`).
- **Hors du dépôt** : toute donnée réelle de joueurs (export de production, même anonymisé)
  vit en dehors du dépôt, dans le dossier désigné par la variable d'environnement
  `FTP_REAL_FIXTURES_DIR`. Les tests qui en ont besoin se sautent quand elle est absente.
- Jamais de vrais e-mails ni de vrais pseudos dans le dépôt, les fixtures ou les captures.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
