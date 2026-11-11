#!/usr/bin/env bash
# After Claude's run: releases its claim, then asks the owners when needed.
#   NEEDS-ANSWER: line in its message      -> mention the owners, label agent:needs-answer;
#   failed on its plan's quota             -> wait (agent:waiting-quota), retried every hour;
#   failed otherwise                       -> mention the owners;
#   autonomous run that changed nothing    -> mention the owners.
# Env: STATUS (success|failure), LOG (file to scan), MESSAGE (its final message), PR (number it
# opened, may be empty), NUMBER, KIND (issue|pr), AUTO (true when started by a label).
set -euo pipefail
here=$(dirname "$0")
# shellcheck source=ci/agents/lib.sh
. "$here/lib.sh"

remove_label "$NUMBER" agent:working-claude

question=$(grep -m1 -E '^[[:space:]]*NEEDS-ANSWER:' <<< "${MESSAGE:-}" | sed -E 's/^[[:space:]]*NEEDS-ANSWER:[[:space:]]*//' || true)
if [ -n "$question" ]; then
  ask_owner "$NUMBER" "**Claude** a besoin d'une réponse : $question"
  exit 0
fi

if [ "$STATUS" != success ]; then
  # Only the end of the log: the start holds the files Claude read, which may contain any word.
  if [ -f "${LOG:-}" ] && tail -n 60 "$LOG" | grep -Eiq "$quota_re"; then
    add_label "$NUMBER" agent:waiting-quota
    comment as_bot "$NUMBER" "**Claude** n'a plus de quota au milieu de cette tâche ([run]($run_url)). Nouvel essai automatique toutes les heures ; il reprendra la branche \`claude/…\` déjà poussée, s'il y en a une.
<!-- agents:quota claude -->"
  else
    ask_owner "$NUMBER" "**Claude** a échoué sur cette tâche (voir le run)."
  fi
  exit 0
fi

if [ "${AUTO:-false}" = true ] && [ "$KIND" = issue ] && [ -z "${PR:-}" ]; then
  ask_owner "$NUMBER" "**Claude** a terminé sans modification ni PR."
fi
