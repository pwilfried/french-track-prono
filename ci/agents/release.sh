#!/usr/bin/env bash
# Tags a finished version, which puts it in production (migrations.yml runs on vX.Y.Z tags).
# The version is the open milestone `vX.Y …` right after the latest tag. It is tagged vX.Y.0 when:
#   - the milestone has closed issues and no open one;
#   - every push run on main's last commit (CI, …) is completed and green.
# The tag is made with AGENTS_PAT: a tag made with github.token would start no workflow.
# Then a GitHub release lists the PRs (its notification tells the owners) and the milestone closes.
# main red: no tag, a warning in the run; the hourly sweep tries again.
# Env: BOT_TOKEN, PAT_TOKEN.
set -euo pipefail
here=$(dirname "$0")
# shellcheck source=ci/agents/lib.sh
. "$here/lib.sh"

if ! has_pat; then
  echo "No AGENTS_PAT secret: no automatic tag (it would not start the deployment)."
  exit 0
fi

latest=$(as_bot gh api --paginate "repos/$repo/tags?per_page=100" --jq '.[].name' |
  grep -E '^v[0-9]+\.[0-9]+\.[0-9]+$' | sort -V | tail -1 || true)
if [ -z "$latest" ]; then
  echo "No vX.Y.Z tag yet: the first one is made by hand."
  exit 0
fi

# Open milestones newer than the latest tag, oldest first: "<vX.Y> <number> <open> <closed>".
next=$(as_bot gh api --paginate "repos/$repo/milestones?state=open&per_page=100" \
  --jq '.[] | select(.title | test("^v[0-9]+\\.[0-9]+( |$)")) |
        "\(.title | split(" ")[0]) \(.number) \(.open_issues) \(.closed_issues)"' |
  while read -r v number open closed; do
    if [ "$(printf '%s\n%s\n' "$latest" "$v.0" | sort -V | tail -1)" != "$latest" ]; then
      echo "$v $number $open $closed"
    fi
  done | sort -V | head -1)
if [ -z "$next" ]; then
  echo "No milestone after $latest."
  exit 0
fi
read -r version number open closed <<< "$next"
tag="$version.0"
if [ "$open" != 0 ] || [ "$closed" = 0 ]; then
  echo "$version: $open open issue(s), $closed closed: not finished."
  exit 0
fi

sha=$(as_bot gh api "repos/$repo/commits/main" --jq .sha)
runs=$(as_bot gh api "repos/$repo/actions/runs?head_sha=$sha&event=push&per_page=100" \
  --jq '.workflow_runs[] | "\(.name)|\(.status)|\(.conclusion)"')
if [ -z "$runs" ] || ! grep -q '^CI|' <<< "$runs"; then
  echo "$version is finished, but main's CI has not run yet on ${sha:0:7}."
  exit 0
fi
if grep -qv '|completed|\(success\|skipped\|neutral\)$' <<< "$runs"; then
  if grep -q '|completed|' <<< "$runs" && ! grep -qv '|completed|' <<< "$runs"; then
    echo "::warning::$version is finished, but main is red on ${sha:0:7}: no tag."
  else
    echo "$version is finished, main's runs are still going on ${sha:0:7}."
  fi
  echo "$runs"
  exit 0
fi

echo "Tagging $tag on ${sha:0:7}"
message="$tag

$(as_bot gh api "repos/$repo/compare/$latest...$sha" --jq '.commits[].commit.message | split("\n")[0]' |
  grep -v '^Merge ' | sed 's/^/- /')"
object=$(as_owner gh api -X POST "repos/$repo/git/tags" -f "tag=$tag" -f "message=$message" \
  -f "object=$sha" -f type=commit --jq .sha)
as_owner gh api -X POST "repos/$repo/git/refs" -f "ref=refs/tags/$tag" -f "sha=${object:-$sha}" >/dev/null
as_owner gh api -X POST "repos/$repo/releases" -f "tag_name=$tag" -f "name=$tag" \
  -F generate_release_notes=true >/dev/null
as_bot gh api -X PATCH "repos/$repo/milestones/$number" -f state=closed >/dev/null
echo "$tag tagged: the deployment runs in migrations.yml."
