#!/usr/bin/env bash
# Deploys the checked-out commit to a Vercel project's production, then smoke-tests it (#405, #720).
# Usage: ci/vercel-deploy.sh <base url>, e.g. https://www.frenchtrackprono.com
# Env: VERCEL_TOKEN, VERCEL_ORG_ID, VERCEL_PROJECT_ID (the project: production or pre-production);
#      GH_TOKEN (issues: write), GITHUB_REPOSITORY, GITHUB_RUN_ID, AGENTS_OWNER (owners to notify);
#      optional VERCEL_EXTRA_ENV: KEY=value lines added to the pulled environment before the build
#      (pre-production's NEXT_PUBLIC_SITE_NOINDEX=1).
#   1. `vercel pull`, then the pulled environment must hold the Supabase variables (names only are
#      printed): on 13 Nov 2026 they had vanished, the build passed and every page answered 500.
#   2. build, then a production deploy that takes the domains at once (no `vercel promote`: with
#      the project token it answers "User not found", #731). After a `vercel rollback`, Vercel
#      keeps new deploys off the domains until the rollback is undone in the dashboard: the issue
#      opened below says so.
#   3. smoke test; if it fails, `vercel rollback` puts the previous deployment back and an issue
#      tells the owners. The job stays red either way.
set -euo pipefail
base="${1:?usage: ci/vercel-deploy.sh <base url>}"
here=$(cd "$(dirname "$0")" && pwd)
smoke="${SMOKE_TEST:-$here/../scripts/smoke.sh}"
vercel() { npx --yes vercel@latest "$@" --token="$VERCEL_TOKEN"; }
# `rollback` acts on a deployment, not on the linked project, so it gets the team scope (#732).
# `promote` failed with « User not found » even with it (#731): deploys take the domains directly.
scope=()
[ -n "${VERCEL_ORG_ID:-}" ] && scope=(--scope "$VERCEL_ORG_ID")

# The variables without which every page fails (src/infra/supabase).
required=(NEXT_PUBLIC_SUPABASE_URL NEXT_PUBLIC_SUPABASE_ANON_KEY)

vercel pull --yes --environment=production
env_file=.vercel/.env.production.local
missing=()
for name in "${required[@]}"; do
  # Present with a non-empty value; the value itself is never printed.
  grep -qE "^$name=(\"[^\"]|'[^']|[^\"'[:space:]])" "$env_file" 2>/dev/null || missing+=("$name")
done
if [ "${#missing[@]}" -gt 0 ]; then
  echo "::error::Missing in the Vercel production environment: ${missing[*]}. Nothing is deployed (docs/SETUP.md, « Déploiements Vercel »)."
  exit 1
fi
if [ -n "${VERCEL_EXTRA_ENV:-}" ]; then
  printf '\n%s\n' "$VERCEL_EXTRA_ENV" >> "$env_file"
fi

vercel build --prod
vercel deploy --prebuilt --prod

if "$smoke" "$base"; then
  exit 0
fi

echo "::error::The smoke test of $base failed: rolling back to the previous deployment."
rolled_back="oui"
vercel rollback "${scope[@]}" || rolled_back="non (à faire à la main : Vercel → Deployments → Instant Rollback)"

repo=${GITHUB_REPOSITORY:?}
owners=${AGENTS_OWNER:-${repo%%/*}}
mentions=$(sed -E 's/(^| +)/\1@/g' <<< "$owners")
run_url="${GITHUB_SERVER_URL:-https://github.com}/$repo/actions/runs/${GITHUB_RUN_ID:-0}"
gh issue create -R "$repo" --label bug --label needs-human \
  --title "Déploiement annulé : le test de fumée de $base a échoué" \
  --body "$mentions le test de fumée a échoué juste après le déploiement : $run_url

Retour au déploiement précédent : $rolled_back.

Regarder le journal du job, corriger, annuler le retour arrière dans Vercel (Deployments → « Undo Rollback », sinon les déploiements suivants ne prennent pas les domaines), puis relancer le workflow (docs/SETUP.md, « Déploiements Vercel »)." ||
  echo "::error::Could not open the issue for the owners."
exit 1
