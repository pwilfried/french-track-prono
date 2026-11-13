import { spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { expect, it } from "vitest";

const sha = "abcdef1234567890";

/**
 * Runs ci/agents/release.sh against a fake gh that answers the GitHub API from these fixtures
 * (through the same --jq filters); writes are only printed (DRY_RUN). v0.17 is finished.
 * A run name ending with "!" failed, one ending with "…" is still going.
 */
function release({ runs }: { runs?: string[] } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "agents-release-"));
  const api: Record<string, unknown> = {
    "repos/owner/repo/tags?per_page=100": [{ name: "v0.16.0" }],
    "repos/owner/repo/milestones?state=open&per_page=100": [
      { title: "v0.17 Ligues thématiques", number: 7, open_issues: 0, closed_issues: 5 },
    ],
    "repos/owner/repo/commits/main": { sha },
    [`repos/owner/repo/actions/runs?head_sha=${sha}&event=push&per_page=100`]: {
      workflow_runs: (runs ?? ["CI", "Pre-production"]).map((run) => ({
        name: run.replace(/[!…]$/, ""),
        status: run.endsWith("…") ? "in_progress" : "completed",
        conclusion: run.endsWith("!") ? "failure" : run.endsWith("…") ? null : "success",
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

it("tags a finished version once main is green, pre-production included, without waiting for a go", () => {
  const out = release();
  expect(out).toContain("Tagging v0.17.0 on abcdef1");
  expect(out).toContain("refs/tags/v0.17.0");
  expect(out).toContain("Vérifier v0.17.0 en prod");
  expect(out).toContain("- [ ] #41 feat: add a screen");
  expect(out).not.toContain("#42 ");
  expect(out).toContain("milestones/7 -f state=closed");
  expect(out).toContain("v0.17.0 tagged");
});

it("waits for the next sweep when the pre-production deploy of main's commit failed", () => {
  const out = release({ runs: ["CI", "Pre-production!"] });
  expect(out).toContain("the pre-production deploy of abcdef1 failed: no tag");
  expect(out).not.toContain("Tagging");
});

it("waits while the pre-production deploy of main's commit is still going", () => {
  const out = release({ runs: ["CI", "Pre-production…"] });
  expect(out).toContain("main's runs are still going");
  expect(out).not.toContain("Tagging");
});

it("tags a finished version when there is no pre-production run on main's commit", () => {
  const out = release({ runs: ["CI"] });
  expect(out).toContain("Tagging v0.17.0 on abcdef1");
});

it("does not tag while main's CI is red", () => {
  const out = release({ runs: ["CI!", "Pre-production"] });
  expect(out).toContain("main is red");
  expect(out).not.toContain("Tagging");
});
