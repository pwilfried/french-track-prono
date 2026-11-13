import { spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { expect, it } from "vitest";

const sha = "abcdef1234567890";
type Validation = {
  number: number;
  state: "open" | "closed";
  state_reason?: string | null;
  comments?: { login: string; body: string }[];
};

/**
 * Runs ci/agents/release.sh against a fake gh that answers the GitHub API from these fixtures
 * (through the same --jq filters); writes are only printed (DRY_RUN). v0.17 is finished.
 */
function release({ validation, runs }: { validation?: Validation; runs?: string[] } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "agents-release-"));
  const api: Record<string, unknown> = {
    "repos/owner/repo/tags?per_page=100": [{ name: "v0.16.0" }],
    "repos/owner/repo/milestones?state=open&per_page=100": [
      { title: "v0.17 Ligues thématiques", number: 7, open_issues: 0, closed_issues: 5 },
    ],
    "repos/owner/repo/commits/main": { sha },
    [`repos/owner/repo/actions/runs?head_sha=${sha}&event=push&per_page=100`]: {
      workflow_runs: (runs ?? ["CI", "Pre-production"]).map((name) => ({
        name,
        status: "completed",
        conclusion: name.endsWith("!") ? "failure" : "success",
      })),
    },
    [`repos/owner/repo/compare/v0.16.0...${sha}`]: {
      commits: [
        { commit: { message: "feat: add a screen (#41)" } },
        { commit: { message: "chore: tidy the scripts (#42)" } },
      ],
    },
    "repos/owner/repo/pulls/41/files?per_page=100": [{ filename: "src/app/page.tsx" }],
    "repos/owner/repo/pulls/42/files?per_page=100": [{ filename: "ci/agents/lib.sh" }],
    "repos/owner/repo/pulls/41": { title: "feat: add a screen" },
    "repos/owner/repo/milestones/7": { description: "It works when the league is themed." },
    "repos/owner/repo/issues?state=all&labels=needs-human&per_page=100": [
      { number: 90, state: "open", state_reason: null, title: "Valider v0.16.0 en préprod" },
      ...(validation
        ? [{ title: "Valider v0.17.0 en préprod", state_reason: null, ...validation }]
        : []),
    ],
    ...(validation
      ? {
          [`repos/owner/repo/issues/${validation.number}/comments`]: (
            validation.comments ?? []
          ).map((c) => ({ user: { login: c.login }, body: c.body })),
        }
      : {}),
  };
  writeFileSync(join(dir, "api.json"), JSON.stringify(api));
  writeFileSync(
    join(dir, "gh"),
    `#!/usr/bin/env bash
[ "$1" = api ] || exit 0
shift
path="" jq_filter="."
while [ $# -gt 0 ]; do
  case $1 in
    --jq) jq_filter=$2; shift 2 ;;
    --paginate) shift ;;
    -X | -f | -F) shift 2 ;;
    *) path=$1; shift ;;
  esac
done
jq -c --arg p "$path" '.[$p] // error("no fixture for " + $p)' "${dir}/api.json" | jq -r "$jq_filter"
`,
  );
  chmodSync(join(dir, "gh"), 0o755);
  // stdout, then the writes DRY_RUN printed instead of doing them (stderr).
  const run = spawnSync("bash", ["ci/agents/release.sh"], {
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: `${dir}:${process.env.PATH}`,
      GITHUB_REPOSITORY: "owner/repo",
      AGENTS_OWNER: "boss",
      DRY_RUN: "1",
      BOT_TOKEN: "bot",
      PAT_TOKEN: "pat",
    },
  });
  if (run.status !== 0) throw new Error(run.stderr);
  return run.stdout + run.stderr;
}

it("opens the pre-production validation issue instead of tagging a finished version (#634)", () => {
  const out = release();
  expect(out).toContain("opening « Valider v0.17.0 en préprod »");
  expect(out).toContain("- [ ] #41 feat: add a screen");
  expect(out).not.toContain("#42");
  expect(out).not.toContain("tagging");
});

it("waits for the owner's go before tagging (#634)", () => {
  const out = release({
    validation: {
      number: 91,
      state: "open",
      comments: [
        { login: "someone", body: "go prod" },
        { login: "boss", body: "Looks good,\nbut not yet" },
      ],
    },
  });
  expect(out).toContain("waiting for the owner's go on #91");
  expect(out).not.toContain("tagging");
});

it("tags the version after a go prod comment of an owner (#634)", () => {
  const out = release({
    validation: { number: 91, state: "open", comments: [{ login: "boss", body: "Go prod !" }] },
  });
  expect(out).toContain("Go on #91: tagging v0.17.0 on abcdef1");
  expect(out).toContain("refs/tags/v0.17.0");
  expect(out).toContain("milestones/7 -f state=closed");
  expect(out).toContain("v0.17.0 tagged");
});

it("tags the version once the validation issue is closed as completed (#634)", () => {
  const out = release({ validation: { number: 91, state: "closed", state_reason: "completed" } });
  expect(out).toContain("Go on #91: tagging v0.17.0");
});

it("does not tag when the validation issue is closed as not planned (#634)", () => {
  const out = release({ validation: { number: 91, state: "closed", state_reason: "not_planned" } });
  expect(out).toContain("closed without a go");
  expect(out).not.toContain("tagging");
});

it("does not tag after the go while a run on main, pre-production included, is red (#634)", () => {
  const out = release({
    validation: { number: 91, state: "open", comments: [{ login: "boss", body: "go prod" }] },
    runs: ["CI", "Pre-production!"],
  });
  expect(out).toContain("main is red");
  expect(out).not.toContain("tagging");
});
