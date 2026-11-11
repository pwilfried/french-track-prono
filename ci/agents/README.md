# Agents sur GitHub (`agents.yml`, `agents-merge.yml`)

Claude Code travaille sur les issues et les PR depuis GitHub Actions, sur les runners hébergés par
GitHub (le dépôt est public : minutes gratuites). Les règles de travail des agents sont dans
`AGENTS.md`, « Agents on GitHub ».

## Comment ça tourne

1. Un propriétaire met le label `agent:ready` sur une issue d'un milestone `vX.Y …`.
2. `agents-merge.yml` (après chaque CI, chaque run d'agent, et toutes les heures) prend les issues
   `agent:ready` du milestone en cours, deux à la fois, et leur met `agent:claude`.
3. `agents.yml` lance Claude Code : il travaille sur une branche `claude/…`, la pousse, et le
   workflow ouvre la PR (`Closes #n`, labels et milestone de l'issue).
4. CI verte : la PR est fusionnée (squash), après y avoir fusionné `main` si elle était en retard.
   CI rouge ou conflit : la PR repart à Claude avec les logs (3 essais, puis le propriétaire).
5. Une PR fusionnée qui touche l'interface laisse une issue `needs-human` « Check the UI of #n ».
6. Le tag (mise en prod) reste fait à la main par le propriétaire.

Une issue n'est jamais prise si elle a `needs-human`, `agent:blocked` ou `after-ui`, ou si une
issue qui la bloque est encore ouverte (lien GitHub « blocked by » ou ligne `Blocked by #n`).

## Depuis le téléphone (app GitHub)

- Lancer : label `agent:ready` (la chaîne la prendra), ou `agent:claude` (tout de suite), ou un
  commentaire `@claude …` sur une issue ou une PR.
- Répondre : Claude mentionne les propriétaires et met `agent:needs-answer` ; répondre par un
  commentaire `@claude …`.
- Tout arrêter : désactiver le workflow `agents-merge` (Actions, agents-merge, « … », Disable
  workflow). `@claude` marche toujours à la main.

Seuls les logins de la variable `AGENTS_OWNER` déclenchent quelque chose : un commentaire
`@claude` d'un autre compte est ignoré. Les PR de forks ne sont jamais fusionnées
automatiquement, seules les branches `claude/…` de ce dépôt.

## Mise en place (une fois, par le propriétaire du dépôt)

1. **Installer l'app Claude GitHub** sur le dépôt : https://github.com/apps/claude (choisir
   « Only select repositories », `french-track-prono`).
2. **Jeton Claude** : sur un Mac connecté à Claude Code avec un abonnement Pro ou Max,
   ```bash
   claude setup-token
   gh secret set CLAUDE_CODE_OAUTH_TOKEN -R pwilfried/french-track-prono
   ```
   Les agents consomment le quota de cet abonnement. À défaut, `ANTHROPIC_API_KEY` (facturé à
   l'usage sur l'API).
3. **`AGENTS_PAT`** : le jeton du workflow ne peut pas lancer d'autres workflows ; sans ce PAT,
   les PR des agents n'ont pas de CI et la chaîne ne démarre pas l'issue suivante. Créer un
   fine-grained token (Settings, Developer settings, Fine-grained tokens) : propriétaire
   `pwilfried`, seul dépôt `french-track-prono`, durée un an, permissions Contents, Pull requests,
   Issues et Actions en lecture et écriture (pas Workflows). Puis
   ```bash
   gh secret set AGENTS_PAT -R pwilfried/french-track-prono
   ```
4. **Propriétaires** : la variable `AGENTS_OWNER`, logins séparés par des espaces. Le login du
   PAT doit en faire partie.
   ```bash
   gh variable set AGENTS_OWNER -R pwilfried/french-track-prono --body "pwilfried ydiarra"
   ```
5. Facultatif : `AGENTS_CLAUDE_SLOTS` (2 par défaut), le nombre d'issues traitées en même temps.
6. **Réglages du dépôt** (Settings) :
   - Actions, General, « Fork pull request workflows from outside collaborators » : garder
     « Require approval for all external contributors ».
   - Branches : si `main` est protégée, autoriser le squash merge par le login du PAT.

Les labels `agent:claude`, `agent:working-claude`, `agent:needs-answer` et `agent:waiting-quota`
sont créés avec cette PR.

## Ce qui n'est pas automatique

- Les captures d'écran 390 px (clair et sombre) : Claude ne les produit pas sur le runner ; l'issue
  « Check the UI of #n » sert à regarder l'écran après la fusion.
- La base Supabase locale (pgTAP, adaptateurs, e2e) : Claude ne la lance pas, la CI de la PR le fait.
- Le tag de version et la mise en prod.
