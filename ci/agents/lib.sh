# shellcheck shell=bash
# shellcheck disable=SC2034  # variables used by the scripts that source this file
# Helpers shared by ci/agents/*.sh. Env: GITHUB_REPOSITORY, BOT_TOKEN (the workflow's
# github.token) and PAT_TOKEN (the AGENTS_PAT secret, or github.token when it is absent);
# both empty: gh's own login (local tests, with DRY_RUN=1).
#   as_bot:   bookkeeping and messages that must notify the owners (github-actions is not one);
#   as_owner: actions that must start other workflows (a github.token action never does).
repo=$GITHUB_REPOSITORY
# The people the agents answer to: the repository variable AGENTS_OWNER, logins separated by
# spaces (the repository owner when unset). Only they start an agent. The AGENTS_PAT's login
# must be one of them: the chain starts the next issue with it.
OWNERS=${AGENTS_OWNER:-${GITHUB_REPOSITORY_OWNER:-${repo%%/*}}}
OWNER=${OWNERS%% *}
mention_owners=$(sed -E 's/(^| +)/\1@/g' <<< "$OWNERS")
is_owner() { [[ " $OWNERS " == *" $1 "* ]]; }
run_url="${GITHUB_SERVER_URL:-https://github.com}/$repo/actions/runs/${GITHUB_RUN_ID:-0}"
# Messages Claude Code prints when the plan has no usage left.
quota_re='usage limit|rate.?limit|limit reached|hit your .*limit|quota|credit balance|too many requests|(^|[^0-9])429([^0-9]|$)|resets? (at|in)|try again (later|in)|out of (credits|usage)'

# DRY_RUN=1: writes (merges, comments, labels) are printed instead of done.
is_write() { [[ " $* " =~ " "(-X|merge|create|edit|comment)" " || " $* " == *" -f body="* ]]; }
as_bot() { if [ -n "${DRY_RUN:-}" ] && is_write "$@"; then echo "DRY bot: $*" >&2; else env ${BOT_TOKEN:+"GH_TOKEN=$BOT_TOKEN"} "$@"; fi; }
as_owner() { if [ -n "${DRY_RUN:-}" ] && is_write "$@"; then echo "DRY owner: $*" >&2; else env ${PAT_TOKEN:+"GH_TOKEN=$PAT_TOKEN"} "$@"; fi; }
has_pat() { [ "$PAT_TOKEN" != "$BOT_TOKEN" ]; }

# Labels and comments through the issues API work for issues and PRs alike.
labels_of() { as_bot gh api "repos/$repo/issues/$1" --jq '[.labels[].name] | join(",")'; }
has_label() { [[ ",$(labels_of "$1")," == *",$2,"* ]]; }
add_label() { as_bot gh api -X POST "repos/$repo/issues/$1/labels" -f "labels[]=$2" >/dev/null; }
remove_label() { as_bot gh api -X DELETE "repos/$repo/issues/$1/labels/$2" >/dev/null 2>&1 || true; }
comment() { local who=$1 n=$2 body=$3; "$who" gh api "repos/$repo/issues/$n/comments" -f "body=$body" >/dev/null; }
comments_of() { as_bot gh api --paginate "repos/$repo/issues/$1/comments" --jq '.[].body'; }

# True when Claude ran out of its plan in the last 2 hours (marker left by after-agent.sh),
# so it is not given new work in the meantime.
quota_recent() {
  local since; since=$(date -u -d '-2 hours' +%FT%TZ 2>/dev/null || date -u -v-2H +%FT%TZ)
  as_bot gh api "repos/$repo/issues/comments?since=$since&per_page=100" --jq '.[].body' | grep -qF "<!-- agents:quota claude -->"
}

# Stops the autonomous flow on this issue or PR until an owner answers.
ask_owner() {
  comment as_bot "$1" "$mention_owners $2

([run]($run_url)) Réponds par un commentaire \`@claude …\`."
  add_label "$1" agent:needs-answer
}

# gh pr create arguments copying an issue's labels (minus agent:*) and milestone, one per line.
pr_meta_args() {
  as_bot gh api "repos/$repo/issues/$1" --jq '
    (.labels[].name | select(startswith("agent:") | not) | "--label\n" + .),
    (if .milestone then "--milestone\n" + .milestone.title else empty end)'
}

# Conventional PR title (AGENTS.md): the subject of the branch's first commit when it is one,
# otherwise the issue title with a type taken from the issue's labels.
# Args: first commit subject, issue title, labels (comma-separated).
pr_title() {
  local subject=$1 title=$2 labels=",$3," type=chore
  if [[ $subject =~ ^(feat|fix|chore|docs|test|refactor|perf|ci|build|style)(\([^\)]+\))?!?:\ .+ ]]; then
    echo "$subject"
    return
  fi
  case $labels in
    *,feature,*) type=feat ;;
    *,bug,*) type=fix ;;
    *,docs,*) type=docs ;;
  esac
  echo "$type: $title"
}
