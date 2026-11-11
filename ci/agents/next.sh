#!/usr/bin/env bash
# Starts the next issues of the current milestone (lowest "vX.Y …" milestone with an issue that no
# open PR closes yet)
# while Claude has a free slot (AGENTS_CLAUDE_SLOTS, default 2: two issues at a time).
# An issue is picked when an owner labelled it agent:ready, it is not given to Claude yet, no open
# PR closes it, it has no needs-human, agent:blocked nor after-ui label, and every blocker is closed
# (GitHub's "blocked by" links, or "Blocked by #n" lines in its body).
# Order: milestone-plan, then features (p1, p2, p3, then the oldest), then refactor-check once no
# feature is left, then docs-check last.
# It labels each picked issue agent:claude as an owner (AGENTS_PAT), which starts Claude.
# Env: BOT_TOKEN, PAT_TOKEN, AGENTS_CLAUDE_SLOTS.
set -euo pipefail
here=$(dirname "$0")
# shellcheck source=ci/agents/lib.sh
. "$here/lib.sh"

issues_state=$(as_bot gh issue list -R "$repo" --state open --limit 200 --json number,labels,milestone)
open_prs=$(as_bot gh pr list -R "$repo" --state open --limit 50 --json number,labels,body)
if jq -e '[.[] | select([.labels[].name] | index("agent:waiting-quota"))] | length > 0' <<< "$issues_state" >/dev/null; then
  echo "An issue waits for Claude's quota: nothing started."; exit 0
fi
if quota_recent; then echo "Claude out of plan in the last 2 hours: nothing started."; exit 0; fi

# Issues an open PR closes: Claude has handed its work over, they do not hold a slot.
closing=$(jq -r '.[].body // ""' <<< "$open_prs" | grep -oiE '(close[sd]?|fix(e[sd])?|resolve[sd]?) #[0-9]+' | grep -oE '[0-9]+' | sort -u || true)
on_issue=$(jq --arg closing "$closing" '($closing | split("\n") | map(select(. != "") | tonumber)) as $done
  | [.[] | select(.number as $n | $done | index($n) | not)
  | select([.labels[].name] | any(. == "agent:claude" or . == "agent:working-claude"))] | length' <<< "$issues_state")
on_pr=$(jq '[.[] | select([.labels[].name] | index("agent:working-claude"))] | length' <<< "$open_prs")
slots=${AGENTS_CLAUDE_SLOTS:-2} busy=$((on_issue + on_pr))
echo "Claude: $busy of $slots slot(s) busy"
free=$((slots - busy))
[ "$free" -gt 0 ] || { echo "No slot free: nothing started."; exit 0; }

# The current milestone: the lowest "vX.Y …" one with an issue left to do. An issue an open PR
# closes is done for the agents: they move on while that PR waits for its merge.
current=$(jq -r --arg closing "$closing" '($closing | split("\n") | map(select(. != "") | tonumber)) as $done
  | .[] | select(.milestone != null and (.milestone.title | test("^v[0-9]")))
  | select(.number as $n | $done | index($n) | not) | .milestone.title' <<< "$issues_state" \
  | sort -uV | head -1)
[ -n "$current" ] || { echo "No open milestone with an issue left to do."; exit 0; }
issues=$(as_bot gh issue list -R "$repo" --milestone "$current" --state open --limit 100 \
  --json number,title,labels,body,blockedBy)
kind='([.labels[].name] | if index("milestone-plan") then "plan" elif index("refactor-check") then "refactor" elif index("docs-check") then "docs" else "feature" end)'
count() { jq --arg k "$1" "[.[] | select($kind == \$k)] | length" <<< "$issues"; }
features=$(count feature) plans=$(count plan) refactors=$(count refactor)

picks=()
while read -r i; do
  [ "${#picks[@]}" -lt "$free" ] || break
  n=$(jq -r .number <<< "$i"); k=$(jq -r "$kind" <<< "$i")
  jq -e '[.labels[].name] | index("agent:ready")' <<< "$i" >/dev/null || continue
  jq -e '[.labels[].name] | any((startswith("agent:") and . != "agent:ready") or . == "needs-human" or . == "after-ui")' <<< "$i" >/dev/null && continue
  grep -qx "$n" <<< "$closing" && continue
  case $k in
    refactor) { [ "$features" -gt 0 ] || [ "$plans" -gt 0 ]; } && { echo "#$n: refactor-check waits for the features"; continue; } ;;
    docs) { [ "$features" -gt 0 ] || [ "$plans" -gt 0 ] || [ "$refactors" -gt 0 ]; } && { echo "#$n: docs-check waits for the rest"; continue; } ;;
  esac
  blockers=$( { jq -r '(.blockedBy.nodes // .blockedBy // [])[]? | .number? // empty' <<< "$i"
                jq -r '.body // ""' <<< "$i" | grep -iE 'blocked by' | grep -oE '#[0-9]+' | tr -d '#' || true; } | sort -u)
  open_blocker=""
  for b in $blockers; do
    [ "$(as_bot gh api "repos/$repo/issues/$b" --jq .state)" = open ] || continue
    open_blocker=$b; break
  done
  [ -z "$open_blocker" ] || { echo "#$n: blocked by #$open_blocker"; continue; }
  picks+=("$n")
done < <(jq -c "sort_by(($kind | if . == \"plan\" then 0 elif . == \"feature\" then 1 elif . == \"refactor\" then 2 else 3 end),
    ([.labels[].name] | if index(\"p1\") then 0 elif index(\"p2\") then 1 elif index(\"p3\") then 2 else 3 end), .number) | .[]" <<< "$issues")

[ "${#picks[@]}" -gt 0 ] || { echo "Nothing ready in $current."; exit 0; }
for n in "${picks[@]}"; do
  echo "Next: #$n ($current)"
  if has_pat; then
    comment as_bot "$n" "Suivante dans **$current** : je la donne à **Claude**."
    as_owner gh issue edit "$n" -R "$repo" --add-label agent:claude >/dev/null
  elif ! comments_of "$n" | grep -qF "<!-- agents:no-pat -->"; then
    comment as_bot "$n" "<!-- agents:no-pat -->$mention_owners Suivante dans **$current**. Sans le secret AGENTS_PAT je ne peux pas la lancer : ajoute le label agent:claude."
  fi
done
