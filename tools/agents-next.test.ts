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
  {
    prs = [],
    milestones = [],
  }: {
    prs?: { number: number; labels: { name: string }[]; body: string }[];
    milestones?: { title: string; open_issues: number; closed_issues: number }[];
  } = {},
) {
  const dir = mkdtempSync(join(tmpdir(), "agents-next-"));
  writeFileSync(join(dir, "state.json"), JSON.stringify(issues.map((i) => ({ ...i, milestone }))));
  writeFileSync(
    join(dir, "issues.json"),
    JSON.stringify(
      issues.map((i) => ({ ...i, title: `Issue ${i.number}`, body: "", blockedBy: [] })),
    ),
  );
  writeFileSync(join(dir, "prs.json"), JSON.stringify(prs));
  writeFileSync(
    join(dir, "milestones.txt"),
    milestones.map((m) => `${m.title}\t${m.open_issues}`).join("\n") +
      (milestones.length ? "\n" : ""),
  );
  writeFileSync(
    join(dir, "gh"),
    `#!/usr/bin/env bash
case "$*" in
  *"issue list"*--milestone*) cat "${dir}/issues.json" ;;
  *"issue list"*) cat "${dir}/state.json" ;;
  *"pr list"*) cat "${dir}/prs.json" ;;
  *milestones*) cat "${dir}/milestones.txt" ;;
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

it("starts no zone:db issue while another one has an open PR (#1095)", () => {
  const out = next(
    [
      { number: 70, labels: label("feature", "p1", "zone:db") },
      { number: 71, labels: label("feature", "p2") },
    ],
    { prs: [{ number: 80, labels: label("zone:db"), body: "Closes #69" }] },
  );
  expect(out).toContain("#70: waits for the migration in progress");
  expect(out).toContain("Next: #71");
});

it("starts one zone:db issue at a time (#1095)", () => {
  const out = next([
    { number: 72, labels: label("feature", "p1", "zone:db") },
    { number: 73, labels: label("feature", "p2", "zone:db") },
  ]);
  expect(out).toContain("Next: #72");
  expect(out).toContain("#73: waits for the migration in progress");
});

it("ignores a zone:db PR held for a later tag (#1062)", () => {
  const out = next([{ number: 74, labels: label("feature", "p1", "zone:db") }], {
    prs: [{ number: 81, labels: label("zone:db", "agent:held"), body: "Closes #68" }],
  });
  expect(out).toContain("Next: #74");
});

it("works one version ahead of the version waiting for its tag (#1062)", () => {
  const out = next([{ number: 75, labels: label("feature", "p1") }], {
    milestones: [
      { title: "v0.13 Done", open_issues: 0, closed_issues: 4 },
      { title: "v0.13.1 Test", open_issues: 1, closed_issues: 0 },
    ],
  });
  expect(out).toContain("Next: #75");
});

it("starts nothing two versions ahead of the version waiting for its tag (#1062)", () => {
  const out = next([{ number: 76, labels: label("feature", "p1") }], {
    milestones: [
      { title: "v0.12 Done", open_issues: 0, closed_issues: 4 },
      { title: "v0.12.5 Held", open_issues: 2, closed_issues: 1 },
      { title: "v0.13.1 Test", open_issues: 1, closed_issues: 0 },
    ],
  });
  expect(out).toContain("more than one version ahead of v0.12 Done");
  expect(out).not.toContain("Next:");
});
