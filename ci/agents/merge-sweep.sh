#!/usr/bin/env bash
# Merges Claude's green PRs, sends red ones back to Claude (2 tries, then the owners; a failure
# of the tool is rerun once without Claude, #1012) and conflicting ones (3 tries), retries the work waiting for quota (hourly or manual run: GitHub's cron often skips
# hours, #736), then starts the next issues (next.sh).
# Only PRs from a claude/ branch of this repository: never a fork's PR (the repository is public)
# nor a person's. Not merged automatically: drafts, agent:needs-answer, milestone-plan.
# Before merging, a PR behind main gets main merged in (a merge commit, never a rebase) and waits
# for its CI again, so what is merged was tested on top of the latest main. One merge per run.
# A merged PR that changes the interface leaves a needs-human issue to look at its screens.
# Env: BOT_TOKEN, PAT_TOKEN, EVENT.
set -euo pipefail
here=$(dirname "$0")
# shellcheck source=ci/agents/lib.sh
. "$here/lib.sh"
has_pat || echo "::warning::No AGENTS_PAT secret: PRs get no CI, merges start nothing."

seen() { comments_of "$1" | grep -qF "$2"; }
count() { comments_of "$1" | grep -cF "$2" || true; }

failed_logs() { # last lines of each failed job of a PR's checks, at most 2 jobs
  jq -r '.statusCheckRollup[] | select(.conclusion == "FAILURE" or .conclusion == "TIMED_OUT" or .conclusion == "STARTUP_FAILURE") | .detailsUrl // empty' <<< "$1" |
    grep -oE '/job/[0-9]+' | head -2 | while read -r j; do
      echo "#### job ${j#/job/}"
      echo '```'
      as_bot gh run view -R "$repo" --job "${j#/job/}" --log-failed 2>/dev/null | cut -f3- | tail -60
      echo '```'
    done
}

failed_runs() { # the workflow runs of a PR's failed checks, one id per line
  jq -r '.statusCheckRollup[] | select(.conclusion == "FAILURE" or .conclusion == "TIMED_OUT" or .conclusion == "STARTUP_FAILURE") | .detailsUrl // empty' <<< "$1" |
    grep -oE '/runs/[0-9]+' | cut -d/ -f3 | sort -u
}

# green, red, pending or none, from the latest run of each check.
check_state() {
  jq -r '
    [.statusCheckRollup[]
      | if .__typename == "StatusContext" then {name: .context, at: "", s: .state}
        else {name: .name, at: (.startedAt // ""), s: (if .status == "COMPLETED" then .conclusion else .status end)} end
      | select(.s != "SKIPPED" and .s != "NEUTRAL")]
    | group_by(.name) | map(max_by(.at)) | map(.s) as $s
    | if any($s[]; test("^(IN_PROGRESS|QUEUED|WAITING|PENDING|REQUESTED|EXPECTED)$")) then "pending"
      elif any($s[]; test("^(FAILURE|TIMED_OUT|STARTUP_FAILURE|ACTION_REQUIRED|ERROR|CANCELLED)$")) then "red"
      elif ($s | length) == 0 then "none"
      else "green" end' <<< "$1"
}

send_back_red() { # $1 number, $2 PR JSON
  local n=$1 sha mark; sha=$(jq -r '.headRefOid[0:7]' <<< "$2"); mark="<!-- agents:fix sha=$sha -->"
  seen "$n" "$mark" && return 0
  local logs rerun="<!-- agents:rerun sha=$sha -->"
  logs=$(failed_logs "$2")
  # The tool's fault (#1012): rerun the failed jobs once, Claude has nothing to fix. A second
  # failure on the same commit goes to Claude as usual.
  if grep -qiE "$infra_re" <<< "$logs" && ! seen "$n" "$rerun"; then
    failed_runs "$2" | while read -r r; do as_owner gh run rerun "$r" --failed -R "$repo" || true; done
    comment as_bot "$n" "Échec dû à l'outil (GitHub, réseau ou runner), pas au code : jobs relancés une fois, sans Claude. ([run]($run_url))
$rerun"
    return 0
  fi
  if [ "$(count "$n" '<!-- agents:fix ')" -ge 2 ]; then
    ask_owner "$n" "Les checks sont encore rouges après 2 corrections automatiques."
  else
    comment as_owner "$n" "@claude Les checks ont échoué sur $sha. Corrige-les sur cette branche (pas de rebase, pas de force-push), puis pousse.

$logs
$mark"
  fi
}

send_back_conflict() { # $1 number, $2 short sha
  local n=$1 mark="<!-- agents:conflict sha=$2 -->"
  seen "$n" "$mark" && return 0
  if [ "$(count "$n" '<!-- agents:conflict ')" -ge 3 ]; then
    ask_owner "$n" "Cette PR est encore en conflit avec main après 3 résolutions automatiques."; return 0
  fi
  comment as_owner "$n" "@claude Cette PR est en conflit avec main. Fais \`git merge origin/main\` dans la branche (jamais de rebase ni de force-push), résous les conflits, puis pousse.
$mark"
}

# The version to tag next (#1062): the oldest open milestone, finished or not. Only its PRs are
# merged, so its tag holds that version alone; a PR of a later version waits with agent:held and
# is merged at the first sweep after the tag. PRs without a milestone (CI, tooling) never wait.
current=$(open_milestones | head -1 | cut -f1)
echo "Current milestone: ${current:-none}"
prs=$(as_bot gh pr list -R "$repo" --state open --limit 100 \
  --json number,title,headRefName,headRefOid,isCrossRepository,isDraft,labels,mergeable,milestone,files,statusCheckRollup)

claude_prs='[.[] | select(.isCrossRepository | not) | select(.headRefName | startswith("claude/")) | select(.isDraft | not)]'
if [ -n "$current" ]; then
  jq -r --arg m "$current" "$claude_prs"' | .[] | select(.milestone != null and .milestone.title != $m)
      | select([.labels[].name] | index("agent:held") | not) | "\(.number)\t\(.milestone.title)"' <<< "$prs" |
    while IFS=$'\t' read -r n m; do
      echo "#$n ($m) waits for the tag of $current"
      add_label "$n" agent:held
      comment as_bot "$n" "En attente : cette PR est de **$m**, elle sera fusionnée après la mise en prod de **$current** (une version n'embarque que son milestone, #1062)."
    done
fi

# Migrations (#1095, #1124): a new migration must come after every migration of main, or Supabase
# applies the versions out of order. Prints the PR's offending files, nothing when all is fine.
late_migrations() { # $1 PR JSON
  local mine on_main max
  mine=$(jq -r '.files[]?.path | select(test("^supabase/migrations/[0-9]+_.*\\.sql$"))' <<< "$1")
  [ -n "$mine" ] || return 0
  on_main=$(as_bot gh api "repos/$repo/contents/supabase/migrations?ref=main" --jq '.[].name' 2>/dev/null || true)
  max=$(grep -oE '^[0-9]+' <<< "$on_main" | sort -n | tail -1 || true)
  [ -n "$max" ] || return 0
  while read -r path; do
    name=${path##*/}
    grep -qxF "$name" <<< "$on_main" && continue # already on main: an edit, not a new migration
    [ "${name%%_*}" -gt "$max" ] || echo "$name"
  done <<< "$mine"
}

send_back_migrations() { # $1 number, $2 short sha, $3 files
  local n=$1 mark="<!-- agents:migration sha=$2 -->"
  seen "$n" "$mark" && return 0
  if [ "$(count "$n" '<!-- agents:migration ')" -ge 2 ]; then
    ask_owner "$n" "Les migrations de cette PR passent encore avant celles de main après 2 corrections."; return 0
  fi
  comment as_owner "$n" "@claude Ces migrations ont un numéro plus ancien que la dernière migration de main : Supabase les appliquerait dans le désordre. Renomme-les avec un numéro postérieur (vérifie qu'aucune fonction SQL réécrite ne part d'une version périmée), puis pousse.

$(sed 's/^/- /' <<< "$3")
$mark"
}

# Claude's PRs, no milestone first (CI, tooling), then the current milestone, p1 first, then the oldest.
candidates=$(jq -c --arg m "$current" '[.[]
    | select(.isCrossRepository | not) | select(.headRefName | startswith("claude/")) | select(.isDraft | not)
    | select([.labels[].name] | any(. == "agent:needs-answer" or . == "milestone-plan" or . == "agent:working-claude") | not)
    | select(.milestone == null or .milestone.title == $m)]
  | sort_by((if .milestone == null then 0 else 1 end),
      ([.labels[].name] | if index("p1") then 0 elif index("p2") then 1 elif index("p3") then 2 else 3 end), .number) | .[]' <<< "$prs")

while read -r -u 3 pr; do
  [ -n "$pr" ] || continue
  n=$(jq -r .number <<< "$pr"); sha=$(jq -r '.headRefOid[0:7]' <<< "$pr"); full=$(jq -r .headRefOid <<< "$pr")
  state=$(check_state "$pr"); mergeable=$(jq -r .mergeable <<< "$pr")
  echo "#$n $sha: $state, $mergeable"
  # A conflict first: GitHub runs no CI on a head that conflicts with main, so such a PR stays
  # at "none" forever and would never be sent back otherwise (#713).
  case $mergeable in
    CONFLICTING) send_back_conflict "$n" "$sha"; continue ;;
    MERGEABLE) ;;
    *) continue ;; # not computed yet
  esac
  case $state in
    red) send_back_red "$n" "$pr"; continue ;;
    pending | none) continue ;;
  esac
  behind=$(as_bot gh api "repos/$repo/compare/$full...main" --jq .ahead_by)
  if [ "$behind" -gt 0 ]; then
    echo "#$n is $behind commit(s) behind main: merging main in, its CI runs again"
    out=$(as_owner gh api -X PUT "repos/$repo/pulls/$n/update-branch" -f expected_head_sha="$full" 2>&1) ||
      { grep -qi conflict <<< "$out" && send_back_conflict "$n" "$sha"; }
    continue
  fi
  late=$(late_migrations "$pr")
  if [ -n "$late" ]; then send_back_migrations "$n" "$sha" "$late"; continue; fi
  remove_label "$n" agent:held
  echo "Merging #$n"
  # Our own commit message: GitHub's default one lists every commit author as a co-author, and
  # AGENTS.md wants no Co-Authored-By trailer.
  as_owner gh pr merge "$n" -R "$repo" --squash --delete-branch \
    --subject "$(jq -r .title <<< "$pr") (#$n)" --body "Merged by agents-merge on a green CI."
  break # the other PRs are now behind main
done 3<<< "$candidates"

if [ "$EVENT" = schedule ] || [ "$EVENT" = workflow_dispatch ]; then
  for n in $(as_bot gh api "repos/$repo/issues?labels=agent:waiting-quota&state=open&per_page=100" --jq '.[].number'); do
    echo "Retrying #$n (waiting for quota)"
    remove_label "$n" agent:waiting-quota
    if as_bot gh api "repos/$repo/issues/$n" --jq '.pull_request != null' | grep -q true; then
      comment as_owner "$n" "@claude Reprends cette PR là où elle en est."
    else
      remove_label "$n" agent:claude
      as_owner gh issue edit "$n" -R "$repo" --add-label agent:claude >/dev/null
    fi
  done
fi

# A finished milestone on a green main is tagged, which deploys it (release.sh).
"$here/release.sh" || echo "::warning::The release check failed; the next sweep tries again."

"$here/next.sh"
