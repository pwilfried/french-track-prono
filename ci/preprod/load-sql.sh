#!/usr/bin/env bash
# Runs SQL files on the pre-production database (#634), one request each, through the Supabase
# Management API: no database address nor IPv6 needed on the runner, as for the push secrets in
# migrations.yml. Only for idempotent files (the seed, the demo set): it runs at every deploy.
# The seed is always followed by the pre-production demo set (supabase/preprod/demo.sql, #694):
# preprod.yml loads the seed, and an agent cannot edit a workflow file to add the demo set there.
# For the same reason, the owner's account (ci/preprod/owner.sh, #769) follows the demo set and the
# clean-up of the e2e accounts (ci/preprod/cleanup-e2e.sql): admin, in every league left there.
# Usage: ci/preprod/load-sql.sh supabase/seed.sql … Env: SUPABASE_ACCESS_TOKEN, SUPABASE_PROJECT_REF.
set -euo pipefail
: "${SUPABASE_ACCESS_TOKEN:?}" "${SUPABASE_PROJECT_REF:?}"
files=()
owner=false
for file in "$@"; do
  files+=("$file")
  if [ "$file" = supabase/seed.sql ]; then files+=(supabase/preprod/demo.sql); fi
  case "$file" in supabase/seed.sql | ci/preprod/cleanup-e2e.sql) owner=true ;; esac
done
for file in "${files[@]}"; do
  echo "Loading $file"
  jq -Rs '{query: .}' "$file" |
    curl --fail-with-body -sS -X POST \
      "https://api.supabase.com/v1/projects/$SUPABASE_PROJECT_REF/database/query" \
      -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" -H "Content-Type: application/json" \
      --data-binary @- > /dev/null
done
if [ "$owner" = true ]; then "$(dirname "$0")/owner.sh"; fi
