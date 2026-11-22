#!/usr/bin/env bash
# Does this change need the end-to-end suite? (owner's decision, 22 Nov 2026) The e2e journey of
# the CI only runs when a PR, or a push to main, touches the app, the database or the tests
# themselves. A PR of docs, agents, pre-production scripts or GitHub settings skips it: the full
# suite still runs against pre-production once per version, before the tag (ci/agents/release.sh).
# When the changed files cannot be read, the suite runs (never skipped by mistake).
# Writes `e2e=true` or `e2e=false` to $GITHUB_OUTPUT.
# Env: GH_TOKEN, REPO, EVENT (github.event_name), PR (number), BEFORE, AFTER (push SHAs).
set -uo pipefail

APP='^(src/|supabase/|e2e/|public/|package\.json$|package-lock\.json$|next\.config\.ts$|playwright\.config\.ts$|tsconfig\.json$|vercel\.json$|\.nvmrc$|\.github/workflows/ci\.yml$|ci/supabase-env\.sh$|ci/e2e-scope\.sh$)'

out() {
  echo "e2e=$1" >> "${GITHUB_OUTPUT:-/dev/stdout}"
  echo "e2e=$1 ($2)"
}

if [ "$EVENT" = pull_request ]; then
  files=$(gh api --paginate "repos/$REPO/pulls/$PR/files" --jq '.[].filename') || { out true "PR files not readable"; exit 0; }
elif [ "$EVENT" = push ] && [ -n "${BEFORE:-}" ] && [ "${BEFORE//0/}" != "" ]; then
  files=$(gh api "repos/$REPO/compare/$BEFORE...$AFTER" --jq '.files[].filename') || { out true "pushed files not readable"; exit 0; }
else
  out true "no diff to read"
  exit 0
fi

[ -n "$files" ] || { out true "empty file list"; exit 0; }

if grep -qE "$APP" <<< "$files"; then
  out true "the change touches the app"
else
  out false "no app, database or test file changed"
fi
