import { execFileSync } from "node:child_process";
import { chmodSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { expect, it } from "vitest";

const label = (...names: string[]) => names.map((name) => ({ name }));
const milestone = { title: "v0.13.1 Test" };

/** Runs ci/agents/next.sh against a fake gh that knows these issues; nothing is written. */
function next(
  issues: { number: number; labels: { name: string }[]; assignees?: { login: string }[] }[],
) {
  const dir = mkdtempSync(join(tmpdir(), "agents-next-"));
  writeFileSync(join(dir, "state.json"), JSON.stringify(issues.map((i) => ({ ...i, milestone }))));
  writeFileSync(
    join(dir, "issues.json"),
    JSON.stringify(
      issues.map((i) => ({ ...i, title: `Issue ${i.number}`, body: "", blockedBy: [] })),
    ),
  );
  writeFileSync(
    join(dir, "gh"),
    `#!/usr/bin/env bash
case "$*" in
  *"issue list"*--milestone*) cat "${dir}/issues.json" ;;
  *"issue list"*) cat "${dir}/state.json" ;;
  *"pr list"*) echo "[]" ;;
esac
`,
  );
  chmodSync(join(dir, "gh"), 0o755);
  return execFileSync("bash", ["ci/agents/next.sh"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      PATH: `${dir}:${process.env.PATH}`,
      GITHUB_REPOSITORY: "owner/repo",
      DRY_RUN: "1",
      BOT_TOKEN: "bot",
      PAT_TOKEN: "pat",
    },
  });
}

it("skips an issue taken in a local session (agent:local), which holds no slot (#583)", () => {
  const out = next([
    { number: 10, labels: label("feature", "p1", "agent:local") },
    { number: 11, labels: label("feature", "p2") },
  ]);
  expect(out).toContain("Claude: 0 of 2 slot(s) busy");
  expect(out).toContain("Next: #11");
  expect(out).not.toContain("Next: #10");
});

it("picks an issue of the current milestone without the agent:ready label (#655)", () => {
  const out = next([{ number: 20, labels: label("feature", "p1") }]);
  expect(out).toContain("Next: #20");
});

it("never picks an issue held back by a label or assigned to a person (#655)", () => {
  const out = next([
    { number: 30, labels: label("feature", "p1", "agent:blocked") },
    { number: 31, labels: label("feature", "p1", "needs-human") },
    { number: 32, labels: label("feature", "p1", "after-ui") },
    { number: 33, labels: label("feature", "p1"), assignees: [{ login: "someone" }] },
  ]);
  expect(out).not.toContain("Next:");
  expect(out).toContain("Nothing ready in v0.13.1 Test.");
});

it("picks no feature while the milestone-plan issue is open (#655)", () => {
  const out = next([
    { number: 40, labels: label("milestone-plan") },
    { number: 41, labels: label("feature", "p1") },
  ]);
  expect(out).toContain("Next: #40");
  expect(out).toContain("#41: features wait for the milestone-plan");
  expect(out).not.toContain("Next: #41");
});

it("picks the features p1 first, then refactor-check, then docs-check (#655)", () => {
  const out = next([
    { number: 50, labels: label("docs-check") },
    { number: 51, labels: label("refactor-check") },
    { number: 52, labels: label("feature", "p2") },
    { number: 53, labels: label("feature", "p1") },
  ]);
  expect(out).toMatch(/Next: #53[\s\S]*Next: #52/);
  expect(out).not.toContain("Next: #51");
  expect(out).not.toContain("Next: #50");
});

it("picks refactor-check once no feature is left, docs-check after it (#655)", () => {
  expect(
    next([
      { number: 60, labels: label("refactor-check") },
      { number: 61, labels: label("docs-check") },
    ]),
  ).toContain("Next: #60");
  expect(next([{ number: 61, labels: label("docs-check") }])).toContain("Next: #61");
});
