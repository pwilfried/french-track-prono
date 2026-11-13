import { execFileSync } from "node:child_process";
import { chmodSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { expect, it } from "vitest";

const label = (...names: string[]) => names.map((name) => ({ name }));
const milestone = { title: "v0.13.1 Test" };

/** Runs ci/agents/next.sh against a fake gh that knows these issues; nothing is written. */
function next(issues: { number: number; labels: { name: string }[] }[]) {
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
    { number: 10, labels: label("feature", "p1", "agent:ready", "agent:local") },
    { number: 11, labels: label("feature", "p2", "agent:ready") },
  ]);
  expect(out).toContain("Claude: 0 of 2 slot(s) busy");
  expect(out).toContain("Next: #11");
  expect(out).not.toContain("Next: #10");
});
