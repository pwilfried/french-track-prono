#!/usr/bin/env bash
# Publishes the ui-shots PNGs of PR $PR to the boards branch (issue-<n>/shots/, n from its
# "Closes #n", else pr-<PR>) and keeps one comment on the PR showing them.
# Env: GH_TOKEN, GITHUB_REPOSITORY, PR, HEAD_SHA, SHOTS (the folder written by ui-shots/shots.spec.ts).
set -euo pipefail
repo=$GITHUB_REPOSITORY
marker='<!-- ui-shots -->'

issue=$(gh pr view "$PR" -R "$repo" --json body --jq .body | grep -oiE '(closes|fixes|resolves) #[0-9]+' | head -1 | grep -oE '[0-9]+' || true)
dir=${issue:+issue-$issue}
dir=${dir:-pr-$PR}/shots

shopt -s nullglob
pngs=("$SHOTS"/*.png)
if [ ${#pngs[@]} -gt 0 ]; then
  board=$(mktemp -d)
  git fetch -q origin boards
  git worktree add -q "$board" FETCH_HEAD
  rm -rf "${board:?}/$dir" && mkdir -p "$board/$dir" && cp "${pngs[@]}" "$board/$dir/"
  git -C "$board" add "$dir"
  git -C "$board" -c user.name="github-actions[bot]" -c user.email="41898282+github-actions[bot]@users.noreply.github.com" \
    commit -qm "chore: ui-shots of #$PR" || true
  git -C "$board" push -q origin HEAD:boards
  sha=$(git -C "$board" rev-parse HEAD)
fi

body="$marker
### Captures des pages touchées (390 px, clair / sombre)

$(cat "$SHOTS/routes.md" 2>/dev/null || true)
"
if [ ${#pngs[@]} -eq 0 ]; then
  body+="
Aucune page à capturer pour ce commit."
else
  for light in "$SHOTS"/*-light.png; do
    name=$(basename "$light" -light.png)
    raw="https://raw.githubusercontent.com/$repo/$sha/$dir"
    body+="
**$name**
<img src=\"$raw/$name-light.png\" width=\"260\"> <img src=\"$raw/$name-dark.png\" width=\"260\">
"
  done
fi
body+="
_Commit ${HEAD_SHA:0:7}, mis à jour à chaque push._"

id=$(gh api "repos/$repo/issues/$PR/comments" --paginate --jq ".[] | select(.body | startswith(\"$marker\")) | .id" | head -1)
if [ -n "$id" ]; then
  gh api -X PATCH "repos/$repo/issues/comments/$id" -f body="$body" >/dev/null
else
  gh api "repos/$repo/issues/$PR/comments" -f body="$body" >/dev/null
fi
