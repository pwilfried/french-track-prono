import { spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { expect, it } from "vitest";

const sha = "abcdef1234567890";

/** A full e2e pass against pre-production: its commit, when it started, how it ended. */
type Pass = {
  sha?: string;
  at?: string;
  title?: string;
  state?: "success" | "failure" | "running";
};

/**
 * Runs ci/agents/release.sh against a fake gh that answers the GitHub API from these fixtures
 * (through the same --jq filters); writes are only printed (DRY_RUN). v0.17 is finished, its last
 * issue closed at 18:00. A run name ending with "!" failed, one ending with "…" is still going.
 */
/** The go issue « Mettre v0.17.0 en prod » (#90): absent, waiting, or labelled release:go by someone. */
type Gate = { go?: boolean; by?: string } | null;

function release({
  runs,
  e2e,
  gate = { go: true, by: "boss" },
}: { runs?: string[]; e2e?: Pass[]; gate?: Gate } = {}) {
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
    "repos/owner/repo/issues?milestone=7&state=closed&per_page=100": [
      { closed_at: "2026-11-15T17:00:00Z" },
      { closed_at: "2026-11-15T18:00:00Z" },
    ],
    // Full e2e passes against pre-production, newest first (#743, #967).
    "repos/owner/repo/actions/workflows/preprod.yml/runs?event=workflow_dispatch&branch=main&per_page=20":
      {
        workflow_runs: (e2e ?? [{}]).map((pass) => ({
          display_title: pass.title ?? "Pre-production e2e",
          head_sha: pass.sha ?? sha,
          created_at: pass.at ?? "2026-11-15T19:00:00Z",
          status: pass.state === "running" ? "in_progress" : "completed",
          conclusion: pass.state === "running" ? null : (pass.state ?? "success"),
        })),
      },
    "repos/owner/repo/compare/v0.16.0...0ld5ha0000000000": {
      commits: [{ commit: { message: "feat: add a screen (#41)" } }],
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
    "repos/owner/repo/issues?labels=release&state=open&per_page=100": gate
      ? [
          {
            number: 90,
            title: "Mettre v0.17.0 en prod",
            labels: [{ name: "release" }, ...(gate.go ? [{ name: "release:go" }] : [])],
          },
        ]
      : [],
    "repos/owner/repo/issues/90/events?per_page=100": gate?.go
      ? [{ event: "labeled", label: { name: "release:go" }, actor: { login: gate.by ?? "boss" } }]
      : [],
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

it("tags a finished, green version once an owner gave the go (#1076)", () => {
  const out = release();
  expect(out).toContain("Tagging v0.17.0 on abcdef1");
  expect(out).toContain("refs/tags/v0.17.0");
  expect(out).toContain("issue close -R owner/repo 90");
  expect(out).toContain("milestones/7 -f state=closed");
  expect(out).toContain("v0.17.0 tagged");
});

it("opens the go issue with what to check on pre-production, and does not tag (#1076)", () => {
  const out = release({ gate: null });
  expect(out).toContain("issue create -R owner/repo --label release --label needs-human");
  expect(out).toContain("Mettre v0.17.0 en prod");
  expect(out).toContain("- [ ] #41 feat: add a screen");
  expect(out).not.toContain("#42 ");
  expect(out).toContain("release:go");
  expect(out).not.toContain("Tagging");
});

it("waits while the go issue has no release:go (#1076)", () => {
  const out = release({ gate: { go: false } });
  expect(out).toContain("waiting for an owner to add release:go to #90");
  expect(out).not.toContain("Tagging");
});

it("ignores a release:go added by someone who is not an owner (#1076)", () => {
  const out = release({ gate: { go: true, by: "stranger" } });
  expect(out).toContain("waiting for an owner to add release:go to #90");
  expect(out).not.toContain("Tagging");
});

it("waits for the next sweep when the pre-production deploy of main's commit failed", () => {
  const out = release({ runs: ["CI", "Pre-production!"], e2e: [] });
  expect(out).toContain("the pre-production deploy of abcdef1 failed: no tag");
  expect(out).not.toContain("Tagging");
});

it("waits while the pre-production deploy of main's commit is still going", () => {
  const out = release({ runs: ["CI", "Pre-production…"], e2e: [] });
  expect(out).toContain("main's runs are still going");
  expect(out).not.toContain("Tagging");
});

it("tags a finished version when there is no pre-production run on main's commit", () => {
  const out = release({ runs: ["CI"], e2e: [] });
  expect(out).toContain("Tagging v0.17.0 on abcdef1");
});

it("does not tag while main's CI is red", () => {
  const out = release({ runs: ["CI!", "Pre-production"], e2e: [] });
  expect(out).toContain("main is red");
  expect(out).not.toContain("Tagging");
});

it("starts the full e2e suite against pre-production once, before the tag (#743)", () => {
  const out = release({ e2e: [] });
  expect(out).toContain("actions/workflows/preprod.yml/dispatches -f ref=main -f inputs[e2e]=true");
  expect(out).not.toContain("Tagging");
});

it("waits while the full e2e suite runs against pre-production", () => {
  const out = release({ e2e: [{ state: "running" }] });
  expect(out).toContain("full e2e suite against pre-production is running");
  expect(out).not.toContain("dispatches");
  expect(out).not.toContain("Tagging");
});

it("does not tag nor start the suite again when the full e2e suite failed on main's commit", () => {
  const out = release({ e2e: [{ state: "failure" }] });
  expect(out).toContain("the full e2e suite against pre-production failed on abcdef1: no tag");
  expect(out).not.toContain("dispatches");
  expect(out).not.toContain("Tagging");
});

it("tags the commit the full suite passed on, even when main has moved on since (#967)", () => {
  const out = release({ runs: ["CI", "Pre-production…"], e2e: [{ sha: "0ld5ha0000000000" }] });
  expect(out).toContain("Tagging v0.17.0 on 0ld5ha0");
  expect(out).toContain("object=0ld5ha0000000000");
  expect(out).not.toContain("dispatches");
});

it("ignores a pass started before the version's last issue closed, and starts a new one", () => {
  const out = release({ e2e: [{ at: "2026-11-15T17:30:00Z" }] });
  expect(out).toContain("dispatches -f ref=main -f inputs[e2e]=true");
  expect(out).not.toContain("Tagging");
});

it("starts a new pass on main's newer commit after a failed one on an older commit", () => {
  const out = release({ e2e: [{ sha: "0ld5ha0000000000", state: "failure" }] });
  expect(out).toContain("dispatches -f ref=main -f inputs[e2e]=true");
  expect(out).not.toContain("Tagging");
});

it("tags the first green pass of the version, not a later one still running (#969)", () => {
  const out = release({
    runs: ["CI", "Pre-production"],
    e2e: [{ state: "running", at: "2026-11-15T20:00:00Z" }, { sha: "0ld5ha0000000000" }],
  });
  expect(out).toContain("Tagging v0.17.0 on 0ld5ha0");
});
