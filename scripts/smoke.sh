#!/usr/bin/env bash
# Smoke test of the public site (#174): the main pages answer, without error, at once.
# Usage: scripts/smoke.sh https://www.frenchtrackprono.com — no retry: a failure is reported.
# Env: optional VERCEL_AUTOMATION_BYPASS_SECRET, sent as the x-vercel-protection-bypass header so
# the test passes Vercel Authentication (pre-production, #692); nothing extra when it is unset.
set -euo pipefail
base="${1:?usage: scripts/smoke.sh <base url>}"
failed=0

headers=()
if [ -n "${VERCEL_AUTOMATION_BYPASS_SECRET:-}" ]; then
  headers=(-H "x-vercel-protection-bypass: $VERCEL_AUTOMATION_BYPASS_SECRET")
fi

# Fetches a page; checks the status is 200 and the body contains the expected text.
check() {
  local path="$1" expected="$2" body status
  body=$(mktemp)
  status=$(curl -sSL -o "$body" -w '%{http_code}' --max-time 20 "${headers[@]}" "$base$path" || true)
  if [ "$status" != "200" ]; then
    echo "::error::$path answered $status"
    failed=1
  elif ! grep -q "$expected" "$body"; then
    echo "::error::$path does not contain « $expected »"
    failed=1
  else
    echo "ok  $path"
  fi
  rm -f "$body"
}

check "/" "French Track Prono"
check "/epreuves" "French Track Prono"
check "/regles" "Comment jouer"
check "/connexion" "Connexion"
check "/mentions-legales" "Mentions légales"

# One event page, taken from the list of events (the data is read from Supabase). The list shows
# only today's events of the competition it opens first (#788): when there is none, the days and
# competitions it links to are tried, a few at most.
fetch() { curl -sSL --max-time 20 "${headers[@]}" "$base$1" || true; }
first_event() { grep -o 'href="/epreuves/[a-z0-9-]*"' | head -1 | cut -d'"' -f2 || true; }
list=$(fetch "/epreuves")
event=$(first_event <<<"$list")
if [ -z "$event" ]; then
  others=$(grep -o 'href="/competitions?[^"]*"' <<<"$list" | cut -d'"' -f2 | sed 's/&amp;/\&/g' |
    sort -u | head -8 || true)
  while IFS= read -r path; do
    [ -n "$path" ] || continue
    event=$(fetch "$path" | first_event)
    if [ -n "$event" ]; then break; fi
  done <<<"$others"
fi
if [ -z "$event" ]; then
  echo "::error::no event linked from /epreuves nor its days: the database may be unreachable (paused project?)"
  failed=1
else
  check "$event" "French Track Prono"
fi

exit "$failed"
