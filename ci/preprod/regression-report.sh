#!/usr/bin/env bash
# Reports the daily pre-production run of the e2e suite (#636) as issues, so the owner hears of a
# failure on their phone. Usage: ci/preprod/regression-report.sh results.json
#   results.json: Playwright's JSON report (missing or empty: the suite did not even start).
# Env: GITHUB_REPOSITORY, BOT_TOKEN (github.token, issues: write), AGENTS_OWNER, REPORT_URL (the
# Playwright report: screenshots and traces), DRY_RUN=1 (writes printed, not done).
#   - failing tests without an open issue: one new `bug` issue listing them, in the current
#     milestone, mentioning the owners;
#   - failing test with an open issue: a comment on it, no new issue;
#   - open issue whose tests all pass again: one « de nouveau vert » comment; the owner closes it.
# Each issue carries one hidden marker per test (a hash of « file › title »); its comments carry
# a red or green marker, so a green issue is not told twice.
set -euo pipefail
here=$(dirname "$0")
# shellcheck source=../agents/lib.sh
. "$here/../agents/lib.sh"

results=${1:?usage: regression-report.sh results.json}
report=${REPORT_URL:-$run_url}
marker() { printf '<!-- preprod-regression:%s -->' "$(printf '%s' "$1" | sha1sum | cut -c1-12)"; }

# The failing tests, one « file › title » per line. A run that left no report, or errors outside
# any test (global set-up, unreachable site), counts as one failing « suite » test.
failing=$(jq -r '
    [.. | objects | select(has("specs")) | .specs[] | select(.ok | not) | "\(.file) › \(.title)"]
    + (if (.errors // []) | length > 0 then ["lancement de la suite"] else [] end)
    | unique | .[]' "$results" 2>/dev/null) || failing="lancement de la suite"
[ -s "$results" ] || failing="lancement de la suite"

# Open issues of earlier runs: number, then whether their last run marker is green.
open_issues=$(as_bot gh api --paginate "repos/$repo/issues?state=open&labels=bug&per_page=100" \
  --jq '.[] | select(.pull_request | not) | select(.body // "" | contains("<!-- preprod-regression:")) | .number')

declare -A issue_of=()
for n in $open_issues; do
  body=$(as_bot gh api "repos/$repo/issues/$n" --jq '.body')
  while read -r m; do issue_of[$m]=$n; done < <(grep -oE '<!-- preprod-regression:[0-9a-f]{12} -->' <<< "$body" || true)
done

new_list="" new_markers=""
declare -A commented=() still_red=()
while IFS= read -r test; do
  [ -n "$test" ] || continue
  m=$(marker "$test")
  n=${issue_of[$m]:-}
  if [ -z "$n" ]; then
    new_list+="- \`$test\`"$'\n'
    new_markers+="$m"$'\n'
    continue
  fi
  still_red[$n]=1
  # One comment per issue and run, even when several of its tests fail.
  [ -n "${commented[$n]:-}" ] && continue
  commented[$n]=1
  echo "Test still failing, commenting #$n: $test"
  comment as_bot "$n" "<!-- preprod-regression:red -->Toujours en échec en préprod ce matin : \`$test\`.

[Rapport Playwright]($report) (captures et traces) · [run]($run_url)"
done <<< "$failing"

if [ -n "$new_list" ]; then
  # The current milestone: the lowest open « vX.Y … » one, as for the agents (next.sh).
  milestone=$(as_bot gh api "repos/$repo/milestones?state=open&per_page=100" --jq '
    [.[] | select(.title | test("^v[0-9]"))
      | {number, v: (.title | capture("^v(?<v>[0-9.]+)").v | split(".") | map(select(. != "") | tonumber))}]
    | sort_by(.v) | first | .number // empty')
  title="Préprod : le test quotidien échoue ($(date -u +%F))"
  body="$mention_owners le test quotidien de la préprod (https://french-track-preprod.vercel.app) échoue :

${new_list}
[Rapport Playwright]($report) (captures et traces) · [run]($run_url)

Un nouvel échec de ces tests commentera cette issue ; quand ils repasseront au vert, un commentaire le dira. À toi de la fermer.

${new_markers}"
  args=(-X POST "repos/$repo/issues" -f "title=$title" -f "body=$body" -f "labels[]=bug")
  [ -n "$milestone" ] && args+=(-F "milestone=$milestone")
  echo "New failing tests, opening an issue:"$'\n'"$new_list"
  as_bot gh api "${args[@]}" --jq '.html_url'
fi

# Open issues whose tests all pass now: green again, said once.
for n in $open_issues; do
  [ -n "${still_red[$n]:-}" ] && continue
  last=$(comments_of "$n" | grep -oE '<!-- preprod-regression:(red|green) -->' | tail -n 1 || true)
  [ "$last" = "<!-- preprod-regression:green -->" ] && continue
  echo "Green again: #$n"
  comment as_bot "$n" "<!-- preprod-regression:green -->De nouveau vert en préprod ce matin ([run]($run_url)). Tu peux fermer cette issue si c'est réglé."
done
