#!/usr/bin/env bash
# Tags a finished version, which puts it in production (migrations.yml runs on vX.Y.Z tags).
# The version is the open milestone right after the latest tag: `vX.Y …` is tagged vX.Y.0, a patch
# milestone `vX.Y.Z …` is tagged vX.Y.Z (owner's decision, 12 Nov 2026). It is tagged when:
#   - the milestone has closed issues and no open one;
#   - every push run on main's last commit (CI, pre-production deploy, …) is completed and green.
# Every merge into main is already deployed to pre-production (preprod.yml). No human go before
# the tag (owner's decision, 13 Nov 2026): the only automatic guard is that a failed pre-production
# deploy of that commit makes the tag wait for the next sweep.
# The tag is made with AGENTS_PAT: a tag made with github.token would start no workflow.
# Then a GitHub release lists the PRs (its notification tells the owners), a needs-human issue
# « Vérifier vX.Y.Z en prod » lists the screens to look at, and the milestone closes.
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

# Open milestones newer than the latest tag, oldest first: "<vX.Y.Z> <number> <open> <closed>".
next=$(as_bot gh api --paginate "repos/$repo/milestones?state=open&per_page=100" \
  --jq '.[] | select(.title | test("^v[0-9]+\\.[0-9]+(\\.[0-9]+)?( |$)")) |
        "\(.title | split(" ")[0]) \(.number) \(.open_issues) \(.closed_issues)"' |
  while read -r v number open closed; do
    [[ $v =~ ^v[0-9]+\.[0-9]+$ ]] && v="$v.0"
    if [ "$(printf '%s\n%s\n' "$latest" "$v" | sort -V | tail -1)" != "$latest" ]; then
      echo "$v $number $open $closed"
    fi
  done | sort -V | head -1)
if [ -z "$next" ]; then
  echo "No milestone after $latest."
  exit 0
fi
read -r tag number open closed <<< "$next"
version=$tag
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
if grep -q '^Pre-production|completed|' <<< "$runs" &&
  ! grep -q '^Pre-production|completed|\(success\|skipped\|neutral\)$' <<< "$runs"; then
  echo "::warning::$version is finished, but the pre-production deploy of ${sha:0:7} failed: no tag."
  echo "$runs"
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
# One check list for the owners (decision of 12 Nov 2026): the version's criterion, then one box
# per PR of the version that touches the interface.
criterion=$(as_bot gh api "repos/$repo/milestones/$number" --jq '.description // ""')
boxes=""
for pr in $(as_bot gh api "repos/$repo/compare/$latest...$sha" --jq '.commits[].commit.message | split("\n")[0]' |
  grep -oE '\(#[0-9]+\)$' | tr -dc '0-9\n' | sort -un); do
  if as_bot gh api "repos/$repo/pulls/$pr/files?per_page=100" \
    --jq '[.[].filename] | any(test("^src/(app|components)/"))' 2>/dev/null | grep -q true; then
    boxes="$boxes
- [ ] #$pr $(as_bot gh api "repos/$repo/pulls/$pr" --jq .title)"
  fi
done
as_bot gh issue create -R "$repo" --label needs-human --title "Vérifier $tag en prod" \
  --body "$tag est en production. Regarde-la sur ton téléphone, en clair et en sombre.

**Critère de la version**
$criterion

**Écrans changés**${boxes:-
- aucun}

Une case qui ne va pas : ouvre une issue de correction liée ici. Tout est bon : ferme cette issue." >/dev/null
as_bot gh api -X PATCH "repos/$repo/milestones/$number" -f state=closed >/dev/null
echo "$tag tagged: the deployment runs in migrations.yml."
