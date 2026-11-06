#!/bin/sh
# One-shot GitHub setup: repo, labels, milestones, steering issues, boards branch.
# Run once from the project root, after `gh auth login`.
# Safe to re-run: labels are forced, milestones and repo are skipped when they exist.
set -e

REPO="pwilfried/french-track-prono"

if ! gh auth status >/dev/null 2>&1; then
  echo "Run 'gh auth login' first." >&2; exit 1
fi

# 1. Git + repo (single exception to the "never push to main" rule: the very first commit)
if [ ! -d .git ]; then
  git init -b main
  git add .
  git commit -m "chore: initial conception, database schema and project rules"
fi
if ! gh repo view "$REPO" >/dev/null 2>&1; then
  gh repo create "$REPO" --private --source=. --remote=origin --push
fi

# 2. Pre-push hook: from now on, no push to main
chmod +x .githooks/pre-push
git config core.hooksPath .githooks

# 3. Labels
label() { gh label create "$1" --color "$2" --description "$3" --repo "$REPO" --force >/dev/null; }
label feature            0E8A16 "New user-facing capability"
label bug                D73A4A "Something is broken"
label chore              CFD3D7 "Tooling, setup, maintenance"
label docs               0075CA "Documentation only"
label spike              D4C5F9 "Time-boxed investigation ending in a written decision"
label zone:domain        1D76DB "src/domain (pure rules)"
label zone:application   1D76DB "src/application (use cases and ports)"
label zone:infra         1D76DB "src/infra (Supabase adapters, fakes)"
label zone:app           1D76DB "src/app (Next.js pages, UI)"
label zone:db            1D76DB "supabase/ (migrations, seed, pgTAP)"
label zone:ci            1D76DB "CI and tooling"
label c:scoring          FBCA04 "Business area: points and scale"
label c:predictions      FBCA04 "Business area: podium picks, joker, lock"
label c:leagues          FBCA04 "Business area: leagues and invitations"
label c:leaderboard      FBCA04 "Business area: rankings"
label c:auth             FBCA04 "Business area: accounts and magic link"
label c:admin            FBCA04 "Business area: back-office"
label p1                 B60205 "Must be done in the current version"
label p2                 E99695 "Should be done in the current version"
label p3                 F9D0C4 "Nice to have"
label agent:ready        2BB673 "Specified well enough for an agent to take"
label agent:blocked      E4572E "An agent is stuck, needs a decision"
label needs-human        E4572E "Waiting on the owner"
label after-ui           C5DEF5 "Wait for the validated UI board"
label milestone-plan     5319E7 "Steering: break the version into issues"
label refactor-check     5319E7 "Steering: duplicates and dead code review"
label docs-check         5319E7 "Steering: docs are up to date"

# 4. Milestones (+ the 3 steering issues each)
existing() { gh api "repos/$REPO/milestones?state=all&per_page=100" --jq ".[] | select(.title==\"$1\") | .number"; }
milestone() {
  title="$1"; desc="$2"
  num=$(existing "$title")
  if [ -z "$num" ]; then
    gh api "repos/$REPO/milestones" -f title="$title" -f description="$desc" >/dev/null
    for kind in milestone-plan refactor-check docs-check; do
      case "$kind" in
        milestone-plan)  t="Plan $title: break the version into small issues" ;;
        refactor-check)  t="Refactor check for $title" ;;
        docs-check)      t="Docs check for $title" ;;
      esac
      gh issue create --repo "$REPO" --title "$t" --label "$kind" --milestone "$title" \
        --body "Steering issue for $title. See docs/architecture.md, section Versions." >/dev/null
    done
    echo "Created milestone $title"
  else
    echo "Milestone $title already exists, skipped"
  fi
}

milestone "v0.1 Foundation and read-only" "It works when we open on a phone the list of the 28 Ultimate Championship 2026 events and an event page with its official podium, read from the local database."
milestone "v0.2 Accounts" "It works when a new user receives a magic link (local test mailbox), ticks '15 or older', picks a pseudo and finds their profile after signing out."
milestone "v0.3 Predictions" "It works when a player builds a podium in under 20 seconds with a countdown, and the database refuses any change after lock_at (verified by test)."
milestone "v0.4 Back-office and points" "It works when the admin enters a podium, runs the scoring, and test players' points match the numbered cases (perfect podium = 12, with joker = 24)."
milestone "v0.5 Leagues and leaderboards" "It works when two accounts in the same league see the same ranking, tie-broken by perfect podiums then winners found."
milestone "v0.6 Suspense" "It works when others' predictions are unreadable before lock (test), shown after lock, and players can react with emoji."
milestone "v0.7 Going live" "It works when a friend signs up from their phone on the public address, makes a prediction and can delete their account."

# 5. Orphan branch for UI boards (mockups never land on main)
if ! git ls-remote --exit-code --heads origin boards >/dev/null 2>&1; then
  git stash -u >/dev/null 2>&1 || true
  git checkout --orphan boards
  git rm -rf . >/dev/null 2>&1 || true
  printf '# UI boards\n\nMockups and UI proposals. Never merged into main.\n' > README.md
  git add README.md
  git commit -m "chore: init boards branch" >/dev/null
  git -c core.hooksPath=/dev/null push -u origin boards
  git checkout main
  git stash pop >/dev/null 2>&1 || true
fi

echo "Done. Repo: https://github.com/$REPO"
