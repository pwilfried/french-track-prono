#!/usr/bin/env bash
# Puts a finished version in production, after the owner's go in pre-production (#634).
# The version is the open milestone right after the latest tag: `vX.Y …` is tagged vX.Y.0, a patch
# milestone `vX.Y.Z …` is tagged vX.Y.Z (owner's decision, 12 Nov 2026). It is finished when:
#   - the milestone has closed issues and no open one;
#   - every push run on main's last commit (CI, pre-production deploy, …) is completed and green.
# Every merge into main is already in pre-production (preprod.yml). A finished version first opens
# a needs-human issue « Valider vX.Y.Z en préprod » (owner's decision, 13 Nov 2026): the version's
# criterion, the pre-production address, one box per PR that touches the interface. The tag waits
# for the owner's go: a comment `go prod` by an AGENTS_OWNER on that issue, or the issue closed as
# completed. A red main (pre-production included) blocks the go.
# The tag is made with AGENTS_PAT: a tag made with github.token would start no workflow
# (migrations.yml runs on vX.Y.Z tags: production migrations, then the production deploy).
# Then a GitHub release lists the PRs (its notification tells the owners), the validation issue and
# the milestone close.
# Env: BOT_TOKEN, PAT_TOKEN, PREPROD_URL (optional).
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
if grep -qv '|completed|\(success\|skipped\|neutral\)$' <<< "$runs"; then
  if grep -q '|completed|' <<< "$runs" && ! grep -qv '|completed|' <<< "$runs"; then
    echo "::warning::$version is finished, but main is red on ${sha:0:7}: no tag."
  else
    echo "$version is finished, main's runs are still going on ${sha:0:7}."
  fi
  echo "$runs"
  exit 0
fi

# The PRs of the version that touch the interface, one box each (owner's decision, 12 Nov 2026).
ui_boxes() {
  local pr boxes=""
  for pr in $(as_bot gh api "repos/$repo/compare/$latest...$sha" --jq '.commits[].commit.message | split("\n")[0]' |
    grep -oE '\(#[0-9]+\)$' | tr -dc '0-9\n' | sort -un); do
    if as_bot gh api "repos/$repo/pulls/$pr/files?per_page=100" \
      --jq '[.[].filename] | any(test("^src/(app|components)/"))' 2>/dev/null | grep -q true; then
      boxes="$boxes
- [ ] #$pr $(as_bot gh api "repos/$repo/pulls/$pr" --jq .title)"
    fi
  done
  echo "${boxes:-
- aucun}"
}

# The validation issue of this version: "<number> <state> <state_reason>", or nothing.
title="Valider $tag en préprod"
validation=$(as_bot gh api --paginate "repos/$repo/issues?state=all&labels=needs-human&per_page=100" \
  --jq '.[] | select(.pull_request == null) | "\(.number) \(.state) \(.state_reason // "none") \(.title)"' |
  while read -r n state reason rest; do
    if [ "$rest" = "$title" ]; then echo "$n $state $reason"; fi
  done | head -1)
preprod=${PREPROD_URL:-https://french-track-preprod.vercel.app}
criterion=$(as_bot gh api "repos/$repo/milestones/$number" --jq '.description // ""')

if [ -z "$validation" ]; then
  echo "$version is finished and main is green: opening « $title »."
  as_bot gh issue create -R "$repo" --label needs-human --title "$title" \
    --body "$tag est prête et tourne en préprod : $preprod (commit ${sha:0:7}). Regarde-la sur ton téléphone, en clair et en sombre.

**Critère de la version**
$criterion

**Écrans changés**
$(ui_boxes)

Une case qui ne va pas : ouvre une issue de correction liée ici, la mise en prod attend.
Tout est bon : commente \`go prod\` (ou ferme cette issue). Le tag, les migrations de prod, le
déploiement, la release et la fermeture du milestone suivent à la vérification suivante." >/dev/null
  exit 0
fi
read -r issue state reason <<< "$validation"
go=false
if [ "$state" = closed ]; then
  [ "$reason" = completed ] && go=true
else
  while IFS=$'\t' read -r login body; do
    if is_owner "$login" && grep -qiE '^[[:space:]]*go prod([[:space:][:punct:]]|$)' <<< "$body"; then go=true; fi
  done < <(as_bot gh api --paginate "repos/$repo/issues/$issue/comments" \
    --jq '.[] | "\(.user.login)\t\(.body | gsub("[\r\n]+"; " "))"')
fi
if [ "$go" != true ]; then
  if [ "$state" = closed ]; then
    echo "$version: #$issue was closed without a go ($reason): no tag."
  else
    echo "$version is waiting for the owner's go on #$issue."
  fi
  exit 0
fi

echo "Go on #$issue: tagging $tag on ${sha:0:7}"
message="$tag

$(as_bot gh api "repos/$repo/compare/$latest...$sha" --jq '.commits[].commit.message | split("\n")[0]' |
  grep -v '^Merge ' | sed 's/^/- /')"
object=$(as_owner gh api -X POST "repos/$repo/git/tags" -f "tag=$tag" -f "message=$message" \
  -f "object=$sha" -f type=commit --jq .sha)
as_owner gh api -X POST "repos/$repo/git/refs" -f "ref=refs/tags/$tag" -f "sha=${object:-$sha}" >/dev/null
as_owner gh api -X POST "repos/$repo/releases" -f "tag_name=$tag" -f "name=$tag" \
  -F generate_release_notes=true >/dev/null
comment as_bot "$issue" "Go reçu : $tag est tagué sur ${sha:0:7}, la mise en prod tourne (migrations, puis déploiement)."
if [ "$state" != closed ]; then
  as_bot gh api -X PATCH "repos/$repo/issues/$issue" -f state=closed -f state_reason=completed >/dev/null
fi
as_bot gh api -X PATCH "repos/$repo/milestones/$number" -f state=closed >/dev/null
echo "$tag tagged: the deployment runs in migrations.yml."
