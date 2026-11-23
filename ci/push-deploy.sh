#!/usr/bin/env bash
# Deploys the Edge Function `push-notifications` (#502) on a linked Supabase project, production
# (migrations.yml) or pre-production (preprod.yml, #1150): pg_cron calls it every minute.
# A new secret at each run: in the function's secrets first, then in Vault (read by pg_cron,
# private.push_set_secrets). Without the VAPID keys nothing is deployed, and pg_cron calls nothing.
# Env: SUPABASE_ACCESS_TOKEN, SUPABASE_PROJECT_REF, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY,
#   SENTRY_DSN (optional, #527: failed runs reported to Sentry, docs/sentry.md).
set -euo pipefail
: "${SUPABASE_ACCESS_TOKEN:?}" "${SUPABASE_PROJECT_REF:?}"
if [ -z "${VAPID_PUBLIC_KEY:-}" ] || [ -z "${VAPID_PRIVATE_KEY:-}" ]; then
  echo "::notice::No VAPID keys: the push notifications are not deployed."
  exit 0
fi
secret="$(openssl rand -hex 32)"
echo "::add-mask::$secret"
# CLI v3 asks before changing a hosted project unless --yes is given: the job has no terminal.
supabase functions deploy push-notifications --project-ref "$SUPABASE_PROJECT_REF" --no-verify-jwt --yes
supabase secrets set --project-ref "$SUPABASE_PROJECT_REF" --yes \
  PUSH_CRON_SECRET="$secret" VAPID_PUBLIC_KEY="$VAPID_PUBLIC_KEY" VAPID_PRIVATE_KEY="$VAPID_PRIVATE_KEY"
if [ -n "${SENTRY_DSN:-}" ]; then
  supabase secrets set --project-ref "$SUPABASE_PROJECT_REF" --yes SENTRY_DSN="$SENTRY_DSN"
fi
url="https://$SUPABASE_PROJECT_REF.supabase.co/functions/v1/push-notifications"
# Both values are hex or a project ref: no quote to escape in the SQL literals.
sql="select private.push_set_secrets('$url', '$secret')"
jq -n --arg sql "$sql" '{query: $sql}' |
  curl --fail-with-body -sS -X POST \
    "https://api.supabase.com/v1/projects/$SUPABASE_PROJECT_REF/database/query" \
    -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" -H "Content-Type: application/json" \
    --data-binary @- > /dev/null
echo "Push notifications deployed on $SUPABASE_PROJECT_REF."
