#!/usr/bin/env bash
# Opens the PR for the branch an agent pushed for issue $NUMBER, when it has commits and no PR yet,
# with the issue's labels and milestone and a conventional title (pr_title). Opened as the owner
# (AGENTS_PAT) so the CI runs on it.
# Prints number=<pr> to $GITHUB_OUTPUT. Env: BOT_TOKEN, PAT_TOKEN, NUMBER, BRANCH, BASE, TITLE.
# Arg: agent name.
set -euo pipefail
here=$(dirname "$0")
# shellcheck source=ci/agents/lib.sh
. "$here/lib.sh"
agent=$1

ahead=$(as_bot gh api "repos/$repo/compare/$BASE...$BRANCH" --jq .ahead_by 2>/dev/null || true)
[[ $ahead =~ ^[0-9]+$ ]] || ahead=0
if [ "$ahead" -eq 0 ]; then
  echo "Branch $BRANCH was not pushed or has no commit: no PR."
  exit 0
fi

number=$(as_bot gh pr list -R "$repo" --head "$BRANCH" --state open --json number --jq '.[0].number // empty')
if [ -z "$number" ]; then
  # shellcheck disable=SC2016 # backticks are Markdown
  body=$(printf 'Closes #%s\n\nOpened by the `agents` workflow for %s ([run](%s)). Its summary is on the issue.\n\n🤖 Generated with [Claude Code](https://claude.com/claude-code)\n' \
    "$NUMBER" "$agent" "$run_url")
  mapfile -t meta < <(pr_meta_args "$NUMBER")
  first=$(as_bot gh api "repos/$repo/compare/$BASE...$BRANCH" --jq '.commits[0].commit.message | split("\n")[0]' 2>/dev/null || true)
  conventional=$(pr_title "$first" "$TITLE" "$(labels_of "$NUMBER")")
  url=$(as_owner gh pr create -R "$repo" --base "$BASE" --head "$BRANCH" --title "$conventional" --body "$body" "${meta[@]}")
  number=${url##*/}
fi
echo "number=$number" >> "$GITHUB_OUTPUT"
