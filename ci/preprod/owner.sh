#!/usr/bin/env bash
# The owner's account in pre-production (#769): admin, member of every prediction and Manager
# league there (ci/preprod/owner.sql). Run by ci/preprod/load-sql.sh after the seed and demo set,
# and after the clean-up of the e2e accounts: the deploy (preprod.yml) and the daily test
# (preprod-daily.yml) both pass through it, an agent cannot edit those workflow files.
# Skipped with a warning when PREPROD_OWNER_EMAIL is not set; refused outside pre-production.
# The e-mail is never written in the repository nor in the logs.
# Env: PREPROD_OWNER_EMAIL, SUPABASE_PROJECT_REF, SUPABASE_ACCESS_TOKEN.
# PREPROD_OWNER_DRY_RUN=1 prints the SQL instead of sending it (tests).
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
# The pre-production project, as in preprod.yml: a production ref is refused.
preprod_ref=flezuosnpafwcnoubdiu

email="${PREPROD_OWNER_EMAIL:-}"
if [ -z "$email" ]; then
  echo "::warning::PREPROD_OWNER_EMAIL is not in the preprod environment: owner account skipped (docs/SETUP.md)."
  exit 0
fi
if [ "${SUPABASE_PROJECT_REF:-}" != "$preprod_ref" ]; then
  echo "::error::SUPABASE_PROJECT_REF is not the pre-production project: no owner account."
  exit 1
fi
# A plain e-mail only: it goes into the SQL, so no quote nor space can get there.
if ! [[ "$email" =~ ^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$ ]]; then
  echo "::error::PREPROD_OWNER_EMAIL is not an e-mail address: no owner account."
  exit 1
fi
echo "::add-mask::$email"

sql="select set_config('preprod.owner_email', '$email', false);
$(cat "$here/owner.sql")"

if [ "${PREPROD_OWNER_DRY_RUN:-}" = 1 ]; then
  printf '%s\n' "$sql"
  exit 0
fi

: "${SUPABASE_ACCESS_TOKEN:?}"
echo "Owner account: admin, in every league"
printf '%s' "$sql" | jq -Rs '{query: .}' |
  curl --fail-with-body -sS -X POST \
    "https://api.supabase.com/v1/projects/$SUPABASE_PROJECT_REF/database/query" \
    -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" -H "Content-Type: application/json" \
    --data-binary @- > /dev/null
