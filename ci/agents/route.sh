#!/usr/bin/env bash
# Decides whether Claude runs for this event and claims the issue or PR for it.
#   "@claude …" in a comment, a review or a new issue's body, or the label agent:claude -> Claude.
# Only an owner (AGENTS_OWNER) starts anything: the repository is public, anyone can comment.
# The label starts nothing on an issue an open PR closes or a person is assigned to.
# Before starting, a one-word probe checks the plan has usage left; if not, the issue waits
# (agent:waiting-quota) and agents-merge retries it every hour.
# Writes claude, auto to $GITHUB_OUTPUT. Env: EVENT, ACTION, LABEL, BODY, SENDER, NUMBER,
# BOT_TOKEN, PAT_TOKEN, plus the probe's env.
set -euo pipefail
here=$(dirname "$0")
# shellcheck source=ci/agents/lib.sh
. "$here/lib.sh"

out() { echo "$1=$2" >> "$GITHUB_OUTPUT"; }
out claude false; out auto false

is_owner "$SENDER" || { echo "$SENDER is not an owner: nothing to start."; exit 0; }
if [ "$EVENT" = issues ] && [ "$ACTION" = labeled ]; then
  [ "$LABEL" = agent:claude ] || { echo "Label $LABEL: nothing to start."; exit 0; }
  out auto true # from the chain or the owner wanting it done: finishing without a PR is news
  # The hourly quota retry labels it again: an issue someone already handed over keeps its one PR.
  if as_bot gh pr list -R "$repo" --state open --limit 100 --json body --jq '.[].body // ""' | closed_by | grep -qx "$NUMBER"; then
    echo "An open PR already closes #$NUMBER: nothing to start."; exit 0
  fi
  # A person works on it (AGENTS.md): neither the label nor the hourly quota retry starts Claude,
  # and the label goes so that it holds no slot of the chain (next.sh).
  assignees=$(as_bot gh api "repos/$repo/issues/$NUMBER" --jq '[.assignees[].login] | join(", ")')
  if [ -n "$assignees" ]; then
    remove_label "$NUMBER" agent:claude
    comment as_bot "$NUMBER" "Assignée à $assignees : Claude ne démarre pas. Pour le lancer quand même, commente \`@claude …\`. ([run]($run_url))"
    echo "#$NUMBER: assigned to a person: nothing to start."; exit 0
  fi
else
  grep -qiE '(^|[^[:alnum:]_])@claude([^[:alnum:]_-]|$)' <<< "$BODY" || { echo "No @claude: nothing to start."; exit 0; }
fi
if [[ ",$(labels_of "$NUMBER")," == *",agent:working-claude,"* ]]; then
  echo "Claude already works on #$NUMBER: nothing to do."; exit 0
fi

rc=0
if quota_recent; then rc=2; else "$here/probe.sh" || rc=$?; fi
if [ "$rc" -ne 0 ]; then
  if ! has_label "$NUMBER" agent:waiting-quota; then
    add_label "$NUMBER" agent:waiting-quota
    if [ "$rc" -eq 2 ]; then why="plus de quota"; else why="erreur au test de Claude Code, vérifie le secret CLAUDE_CODE_OAUTH_TOKEN"; fi
    comment as_bot "$NUMBER" "Claude n'est pas disponible pour l'instant ($why). Nouvel essai automatique toutes les heures. ([run]($run_url))"
  fi
  exit 0
fi

# What Claude is about to do: the request when it comes from a comment, otherwise the start of the issue.
plan() {
  local req
  req=$(sed -E 's/(^|[[:space:]])@claude([^[:alnum:]_-]|$)/\1\2/I' <<< "${BODY:-}" | sed '/^[[:space:]]*$/d' | head -5)
  if [ "$EVENT" != issues ] && [ -n "$req" ]; then
    printf 'Ta demande :\n\n%s\n' "$(sed 's/^/> /' <<< "$req")"
  else
    printf 'D'"'"'après l'"'"'issue :\n\n> %s\n' "$(as_bot gh api "repos/$repo/issues/$NUMBER" --jq '.body // ""' |
      sed '/^[[:space:]]*$/d' | head -3 | cut -c1-300 | tr '\n' ' ')"
  fi
}

remove_label "$NUMBER" agent:waiting-quota
remove_label "$NUMBER" agent:needs-answer
add_label "$NUMBER" agent:working-claude
out claude true
comment as_bot "$NUMBER" "**Claude** prend cette tâche.

$(plan)
Il ouvrira une PR (ou poussera sur celle-ci) et mentionnera $mention_owners s'il a besoin d'une réponse. ([run]($run_url))"
