#!/usr/bin/env bash
# Tags a finished version, which puts it in production (migrations.yml runs on vX.Y.Z tags).
# The version is the open milestone right after the latest tag: `vX.Y …` is tagged vX.Y.0, a patch
# milestone `vX.Y.Z …` is tagged vX.Y.Z (owner's decision, 12 Nov 2026). It is tagged when:
#   - the milestone has closed issues and no open one;
#   - the full e2e suite has passed against pre-production on a commit that holds the whole version
#     (a pass started after its last issue closed, #743): that commit is tagged, even if main has
#     moved on since (#967). To start that pass, main's last commit must be green (CI, deploy).
# Every merge into main is deployed to pre-production with a smoke test only (preprod.yml); the
# full e2e suite runs once per version, started here when the rest is green (preprod.yml with
# e2e=true), and nowhere else: running it at every merge wore the free pre-production database
# out (owner's decision, 15 Nov 2026), and the daily run was dropped (owner's decision, 22 Nov 2026).
# A failed pre-production deploy or e2e pass of that commit makes it wait. Then the owner gives the
# go (decision of 22 Nov 2026): an issue « Go prod vX.Y.Z » lists what to check in pre-production,
# and closing it as completed tags the commit of the green pass.
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

head=$(as_bot gh api "repos/$repo/commits/main" --jq .sha)
sha=$head
passed=false

# The full e2e suite against pre-production, once per version (#743). A pass counts when it was
# started after the milestone's last issue closed: its commit then holds the whole version. The tag
# goes on THAT commit, even when main has moved on since (#967): agents keep merging the next
# version, and waiting for a green pass on main's newest commit could last forever.
last_close=$(as_bot gh api --paginate "repos/$repo/issues?milestone=$number&state=closed&per_page=100" \
  --jq '.[].closed_at' | sort | tail -1)
passes=$(as_bot gh api "repos/$repo/actions/workflows/preprod.yml/runs?event=workflow_dispatch&branch=main&per_page=20" \
  --jq '.workflow_runs[] | select(.display_title | startswith("Pre-production e2e"))
    | "\(.created_at)|\(.status)|\(.conclusion)|\(.head_sha)"' |
  awk -F'|' -v after="$last_close" '$1 > after')
# The FIRST green pass wins: its commit is the closest to the version, with the least of the next
# version merged since (#969). Without one, the newest pass says whether to wait or start again.
e2e=$(grep '|completed|success|' <<< "$passes" | sort | head -1 || true)
[ -n "$e2e" ] || e2e=$(head -1 <<< "$passes")
IFS='|' read -r _ e2e_status e2e_conclusion e2e_sha <<< "$e2e"
if [ -n "$e2e" ]; then
  if [ "$e2e_status" != completed ]; then
    echo "$version is finished, the full e2e suite against pre-production is running on ${e2e_sha:0:7}."
    exit 0
  fi
  if [ "$e2e_conclusion" = success ]; then
    sha=$e2e_sha
    passed=true
  elif [ "$e2e_sha" = "$head" ]; then
    # No automatic retry (AGENTS.md): the fix merged into main makes a new commit, a new pass.
    echo "::warning::$version is finished, but the full e2e suite against pre-production failed on ${head:0:7}: no tag."
    exit 0
  fi
fi

if [ "$passed" = false ]; then
  runs=$(as_bot gh api "repos/$repo/actions/runs?head_sha=$head&event=push&per_page=100" \
    --jq '.workflow_runs[] | "\(.name)|\(.status)|\(.conclusion)"')
  if [ -z "$runs" ] || ! grep -q '^CI|' <<< "$runs"; then
    echo "$version is finished, but main's CI has not run yet on ${head:0:7}."
    exit 0
  fi
  if grep -q '^Pre-production|completed|' <<< "$runs" &&
    ! grep -q '^Pre-production|completed|\(success\|skipped\|neutral\)$' <<< "$runs"; then
    echo "::warning::$version is finished, but the pre-production deploy of ${head:0:7} failed: no tag."
    echo "$runs"
    exit 0
  fi
  if grep -qv '|completed|\(success\|skipped\|neutral\)$' <<< "$runs"; then
    if grep -q '|completed|' <<< "$runs" && ! grep -qv '|completed|' <<< "$runs"; then
      echo "::warning::$version is finished, but main is red on ${head:0:7}: no tag."
    else
      echo "$version is finished, main's runs are still going on ${head:0:7}."
    fi
    echo "$runs"
    exit 0
  fi
  # main is green and no pass holds the whole version yet: start one on main's commit.
  if grep -q '^Pre-production|' <<< "$runs"; then
    echo "$version is finished: starting the full e2e suite against pre-production on ${head:0:7}."
    as_owner gh api -X POST "repos/$repo/actions/workflows/preprod.yml/dispatches" \
      -f ref=main -f "inputs[e2e]=true" >/dev/null
    exit 0
  fi
fi

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

# The owner's go (decision of 22 Nov 2026, replaces the one of 13 Nov): a finished version waits in
# pre-production. An issue « Go prod vX.Y.Z » lists what to check there; closing it as completed is
# the go, closing it as not planned keeps the version out of production. Its marker holds the
# commit of the green pass, the one that is tagged.
marker="<!-- release-go:$tag -->"
go=$(as_bot gh api --paginate "repos/$repo/issues?state=all&labels=release-go&per_page=100" \
  --jq ".[] | select(.body // \"\" | contains(\"$marker\"))
    | \"\(.number)|\(.state)|\(.state_reason)|\((.body | capture(\"release-sha:(?<s>[^ >]+)\").s) // \"\")\"" |
  head -1 || true)
if [ -z "$go" ]; then
  as_bot gh issue create -R "$repo" --label needs-human --label release-go --title "Go prod $tag" \
    --body "$mention_owners $tag est prête en préprod (https://french-track-preprod.vercel.app) : suite e2e verte sur ${sha:0:7}.

**Critère de la version**
$criterion

**Écrans à regarder en préprod** (téléphone, clair et sombre)${boxes:-
- aucun}

- **Go** : ferme cette issue (« Close as completed ») : tag $tag sur ${sha:0:7}, puis migrations et déploiement en prod.
- **Pas maintenant** : laisse-la ouverte. Une case qui ne va pas : ouvre une issue de correction ; la version attendra.
- **Jamais** : ferme-la comme « not planned ».

$marker
<!-- release-sha:$sha -->" >/dev/null
  echo "$version is ready in pre-production on ${sha:0:7}: waiting for the owner's go."
  # A go given ahead is taken at once (below), not at the next sweep.
  grep -qiE '^[[:space:]]*go prod[[:space:]]*:[[:space:]]*donn' <<< "$criterion" || exit 0
  go=$(as_bot gh api --paginate "repos/$repo/issues?state=all&labels=release-go&per_page=100" \
    --jq ".[] | select(.body // \"\" | contains(\"$marker\")) | \"\(.number)|\(.state)|\(.state_reason)|$sha\"" |
    head -1 || true)
  [ -n "$go" ] || exit 0
fi
IFS='|' read -r go_number go_state go_reason go_sha <<< "$go"
# A go given ahead (owner's decision of 22 Nov 2026 for v0.25 and v0.26): a line « Go prod :
# donné » in the milestone's description closes the issue as completed once the e2e pass is green.
if [ "$go_state" = open ] && grep -qiE '^[[:space:]]*go prod[[:space:]]*:[[:space:]]*donn' <<< "$criterion"; then
  comment as_bot "$go_number" "Go donné d'avance dans la description du milestone (« Go prod : donné ») : tag $tag sur ${go_sha:0:7}."
  as_owner gh api -X PATCH "repos/$repo/issues/$go_number" -f state=closed -f state_reason=completed >/dev/null
  go_state=closed go_reason=completed
fi
if [ "$go_state" = open ]; then
  echo "$version waits for the owner's go (#$go_number)."
  exit 0
fi
if [ "$go_reason" != completed ]; then
  echo "$version: go refused (#$go_number closed as $go_reason). No tag."
  exit 0
fi
sha=$go_sha
[ -n "$sha" ] || { echo "::warning::#$go_number has no commit marker: no tag."; exit 0; }

echo "Tagging $tag on ${sha:0:7} (go in #$go_number)"
message="$tag

$(as_bot gh api "repos/$repo/compare/$latest...$sha" --jq '.commits[].commit.message | split("\n")[0]' |
  { grep -v '^Merge ' || true; } | sed 's/^/- /')" # none when the previous tag is on this commit
object=$(as_owner gh api -X POST "repos/$repo/git/tags" -f "tag=$tag" -f "message=$message" \
  -f "object=$sha" -f type=commit --jq .sha)
as_owner gh api -X POST "repos/$repo/git/refs" -f "ref=refs/tags/$tag" -f "sha=${object:-$sha}" >/dev/null
as_owner gh api -X POST "repos/$repo/releases" -f "tag_name=$tag" -f "name=$tag" \
  -F generate_release_notes=true >/dev/null
as_bot gh api -X PATCH "repos/$repo/milestones/$number" -f state=closed >/dev/null
echo "$tag tagged: the deployment runs in migrations.yml."
