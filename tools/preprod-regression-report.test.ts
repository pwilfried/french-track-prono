import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chmodSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { expect, it } from "vitest";

const marker = (test: string) =>
  `<!-- preprod-regression:${createHash("sha1").update(test).digest("hex").slice(0, 12)} -->`;
const broken = "home.spec.ts › shows the next competition";
const other = "leagues.spec.ts › creates a league";

/** A Playwright JSON report where the listed tests fail and one more passes. */
function results(failing: string[]) {
  const spec = (name: string, ok: boolean) => {
    const [file, title] = name.split(" › ");
    return { file, title, ok, tests: [] };
  };
  return {
    suites: [
      {
        title: "home.spec.ts",
        specs: [],
        suites: [{ title: "", specs: [spec("rules.spec.ts › shows the rules", true)] }],
      },
      { title: "all", specs: failing.map((name) => spec(name, false)) },
    ],
    errors: [],
  };
}

/**
 * Runs ci/preprod/regression-report.sh against a fake gh answering from fixtures; writes are only
 * printed (DRY_RUN). `issues`: the open `bug` issues, with their body and comments.
 */
function report(
  report: unknown,
  issues: { number: number; body: string; comments?: string[] }[] = [],
) {
  const dir = mkdtempSync(join(tmpdir(), "preprod-report-"));
  const api: Record<string, unknown> = {
    "repos/owner/repo/issues?state=open&labels=bug&per_page=100": [
      { number: 99, body: "an unrelated bug" },
      { number: 98, pull_request: {}, body: marker(broken) },
      ...issues.map(({ number, body }) => ({ number, body })),
    ],
    "repos/owner/repo/milestones?state=open&per_page=100": [
      { title: "v0.18 Suite", number: 9 },
      { title: "v0.17.1 Préprod en ligne", number: 8 },
      { title: "Plus tard", number: 3 },
    ],
  };
  for (const { number, body, comments } of issues) {
    api[`repos/owner/repo/issues/${number}`] = { body };
    api[`repos/owner/repo/issues/${number}/comments`] = (comments ?? []).map((c) => ({ body: c }));
  }
  writeFileSync(join(dir, "api.json"), JSON.stringify(api));
  writeFileSync(join(dir, "results.json"), report === null ? "" : JSON.stringify(report));
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
  const run = spawnSync("bash", ["ci/preprod/regression-report.sh", join(dir, "results.json")], {
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: `${dir}:${process.env.PATH}`,
      GITHUB_REPOSITORY: "owner/repo",
      AGENTS_OWNER: "boss",
      REPORT_URL: "https://example.test/report",
      DRY_RUN: "1",
      BOT_TOKEN: "bot",
    },
  });
  if (run.status !== 0) throw new Error(run.stderr);
  return run.stdout + run.stderr;
}

const opened = (out: string) => out.match(/DRY bot: gh api -X POST repos\/owner\/repo\/issues /g);
const comments = (out: string) =>
  out.match(/DRY bot: gh api repos\/owner\/repo\/issues\/\d+\/comments/g);

it("opens one bug issue in the current milestone, mentioning the owner, for a failing test", () => {
  const out = report(results([broken]));
  expect(opened(out)).toHaveLength(1);
  expect(out).toContain("labels[]=bug");
  expect(out).toContain("milestone=8");
  expect(out).toContain("@boss");
  expect(out).toContain(`\`${broken}\``);
  expect(out).toContain("https://example.test/report");
  expect(out).toContain(marker(broken));
  expect(out).not.toContain("rules.spec.ts");
  expect(comments(out)).toBeNull();
});

it("comments the open issue instead of opening another when the same test fails again", () => {
  const out = report(results([broken]), [{ number: 12, body: `failing\n${marker(broken)}` }]);
  expect(opened(out)).toBeNull();
  expect(out).toContain("repos/owner/repo/issues/12/comments");
  expect(out).toContain("<!-- preprod-regression:red -->");
});

it("opens no issue and says nothing when the suite is green and no issue is open", () => {
  const out = report(results([]));
  expect(opened(out)).toBeNull();
  expect(comments(out)).toBeNull();
});

it("tells an open issue once that its tests are green again", () => {
  const issue = { number: 12, body: marker(broken) };
  const first = report(results([]), [issue]);
  expect(first).toContain("repos/owner/repo/issues/12/comments");
  expect(first).toContain("De nouveau vert");
  const second = report(results([]), [
    {
      ...issue,
      comments: ["<!-- preprod-regression:red -->x", "<!-- preprod-regression:green -->y"],
    },
  ]);
  expect(comments(second)).toBeNull();
});

it("keeps an issue red while one of its tests still fails, and opens one for a new failure", () => {
  const out = report(results([broken, other]), [{ number: 12, body: marker(broken) }]);
  expect(opened(out)).toHaveLength(1);
  expect(out).toContain(`\`${other}\``);
  expect(out).not.toContain("De nouveau vert");
});

it("reports a run that left no report as a failure of the whole suite", () => {
  const out = report(null);
  expect(opened(out)).toHaveLength(1);
  expect(out).toContain("lancement de la suite");
});
