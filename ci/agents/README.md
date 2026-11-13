# Agents sur GitHub (`agents.yml`, `agents-merge.yml`)

Claude Code travaille sur les issues et les PR depuis GitHub Actions, sur les runners hébergés par
GitHub (le dépôt est public : minutes gratuites). Les règles de travail des agents sont dans
`AGENTS.md`, « Agents on GitHub ».

## Comment ça tourne

1. Un propriétaire range une issue dans un milestone `vX.Y …`. Le label `agent:ready` n'est plus
   nécessaire (décision du propriétaire du 13 nov. 2026, #655).
2. `agents-merge.yml` (après chaque CI, chaque run d'agent, et toutes les heures) prend les issues
   ouvertes du milestone en cours, deux à la fois, et leur met `agent:claude`. Ordre :
   `milestone-plan`, puis les features (`p1` d'abord) une fois `milestone-plan` fermée, puis
   `refactor-check`, puis `docs-check`. Le milestone
   en cours est le plus petit `vX.Y` qui a encore une issue sans PR ouverte : une version dont
   toutes les issues attendent leur fusion ne bloque pas la suivante.
3. `agents.yml` lance Claude Code : il travaille sur une branche `claude/…`, la pousse, et le
   workflow ouvre la PR (`Closes #n`, labels et milestone de l'issue).
4. CI verte : la PR est fusionnée (squash), après y avoir fusionné `main` si elle était en retard.
   CI rouge ou conflit : la PR repart à Claude avec les logs (3 essais, puis le propriétaire).
5. Chaque fusion dans `main` part en préprod (`preprod.yml`) : migrations sur la base de
   préprod, puis déploiement sur https://french-track-preprod.vercel.app. Une PR fusionnée
   n'ouvre pas d'issue de vérification : c'est la version qui en ouvre une (étape 6).
6. Quand le milestone qui suit le dernier tag n'a plus d'issue ouverte et que tous les
   runs du dernier commit de `main` sont verts (CI et préprod), `release.sh` pose le tag annoté :
   `vX.Y.0` pour un milestone `vX.Y …`, `vX.Y.Z` pour un milestone correctif `vX.Y.Z …`. Il le pose
   avec `AGENTS_PAT`, ce qui lance la mise en prod (`migrations.yml`). Aucun feu vert humain
   (décision du propriétaire du 13 nov. 2026). Une release GitHub liste les PR (sa notification
   prévient les propriétaires), l'issue `needs-human` « Vérifier vX.Y.Z en prod » liste le critère
   et une case par PR qui touche l'interface, et le milestone est fermé. Seul garde-fou : si le
   déploiement en préprod de ce commit a échoué, pas de tag, un avertissement dans le run, nouvel
   essai à la vérification suivante (au plus une heure). Même chose si la CI de `main` est rouge.

Une issue n'est jamais prise si elle a `needs-human`, `agent:blocked`, `after-ui` ou `agent:local`,
si elle est assignée à quelqu'un (une personne la traite : Yannis s'assigne ses issues), ou si une
issue qui la bloque est encore ouverte (lien GitHub « blocked by » ou ligne `Blocked by #n`).
`agent:local` (#583) : une session Claude Code locale a pris l'issue. Elle le pose avant d'écrire
la moindre ligne et le retire si elle abandonne ; sa PR `Closes #n` ferme l'issue comme d'habitude.
Ce label ne prend pas de place à la chaîne.
Le label `agent:claude` ne lance rien sur une issue qu'une PR ouverte ferme déjà (`Closes #n`)
ou qui est assignée à quelqu'un, même quand la relance horaire d'une issue `agent:waiting-quota`
le remet. Sur une issue assignée, le label est retiré (il ne garde pas de place de la chaîne) et
un commentaire le dit. Un commentaire `@claude …` lance toujours Claude.

## Depuis le téléphone (app GitHub)

- Lancer : rien à faire pour une issue du milestone en cours (la chaîne la prendra), sinon
  `agent:claude` (tout de suite) ou un commentaire `@claude …` sur une issue ou une PR.
- Retenir une issue : `agent:blocked` ou `needs-human` (la chaîne la saute).
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
  « Vérifier vX.Y.Z en prod » sert à regarder les écrans une fois la version en production (la
  préprod permet de les voir avant, sans rien bloquer).
- La base Supabase locale (pgTAP, adaptateurs, e2e) : Claude ne la lance pas, la CI de la PR le fait.
- Un tag de correctif sans milestone : à la main, comme avant. Avec un milestone `vX.Y.Z …`, il est
  posé automatiquement.
