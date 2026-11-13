#!/usr/bin/env bash
# Runs SQL files on the pre-production database (#634), one request each, through the Supabase
# Management API: no database address nor IPv6 needed on the runner, as for the push secrets in
# migrations.yml. Only for idempotent files (the seed, later the demo set): it runs at every deploy.
# Usage: ci/preprod/load-sql.sh supabase/seed.sql … Env: SUPABASE_ACCESS_TOKEN, SUPABASE_PROJECT_REF.
set -euo pipefail
: "${SUPABASE_ACCESS_TOKEN:?}" "${SUPABASE_PROJECT_REF:?}"
for file in "$@"; do
  echo "Loading $file"
  jq -Rs '{query: .}' "$file" |
    curl --fail-with-body -sS -X POST \
      "https://api.supabase.com/v1/projects/$SUPABASE_PROJECT_REF/database/query" \
      -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" -H "Content-Type: application/json" \
      --data-binary @- > /dev/null
done
