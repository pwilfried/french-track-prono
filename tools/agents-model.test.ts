import { spawnSync } from "node:child_process";

import { expect, it } from "vitest";

// Runs model_for from ci/agents/lib.sh on a comma-separated list of labels.
function modelFor(labels: string): string {
  const run = spawnSync(
    "bash",
    ["-c", `GITHUB_REPOSITORY=owner/repo . ci/agents/lib.sh && model_for "$1"`, "_", labels],
    { encoding: "utf8" },
  );
  expect(run.status, run.stderr).toBe(0);
  return run.stdout.trim();
}

it("runs Opus where a mistake costs: p1, p2, database, scoring, a plan, or model:opus (#1012)", () => {
  for (const labels of [
    "feature,zone:app,p1",
    "bug,zone:app,p2",
    "feature,zone:db,p3",
    "bug,c:scoring,p3",
    "chore,p1,milestone-plan",
    "feature,zone:app,p3,model:opus",
  ])
    expect(modelFor(labels), labels).toBe("claude-opus-5-5");
});

it("runs Sonnet for the rest: p3, refactor-check, docs-check (#1012)", () => {
  for (const labels of ["feature,zone:app,p3", "chore,refactor-check", "docs,docs-check", ""])
    expect(modelFor(labels), labels).toBe("claude-sonnet-5-5");
});
