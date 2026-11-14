import { spawnSync } from "node:child_process";
import { chmodSync, copyFileSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { expect, it } from "vitest";

type Check = { __typename: string; name: string; status: string; conclusion: string | null };
const pending: Check = {
  __typename: "CheckRun",
  name: "ci",
  status: "IN_PROGRESS",
  conclusion: null,
};
const green: Check = {
  __typename: "CheckRun",
  name: "ci",
  status: "COMPLETED",
  conclusion: "SUCCESS",
};

/** Runs ci/agents/merge-sweep.sh on one Claude PR against a fake gh; nothing is written. */
function sweep(mergeable: string, checks: Check[], event = "workflow_run") {
  const dir = mkdtempSync(join(tmpdir(), "agents-sweep-"));
  for (const f of ["merge-sweep.sh", "lib.sh"]) copyFileSync(`ci/agents/${f}`, join(dir, f));
  for (const f of ["release.sh", "next.sh"]) {
    writeFileSync(join(dir, f), "#!/usr/bin/env bash\n");
    chmodSync(join(dir, f), 0o755);
  }
  const pr = {
    number: 70,
    title: "feat: something",
    headRefName: "claude/issue-69-x",
    headRefOid: "abcdef1234567890",
    isCrossRepository: false,
    isDraft: false,
    labels: [],
    mergeable,
    milestone: null,
    files: [],
    statusCheckRollup: checks,
  };
  writeFileSync(join(dir, "prs.json"), JSON.stringify([pr]));
  writeFileSync(
    join(dir, "gh"),
    `#!/usr/bin/env bash
case "$*" in
  *"pr list"*) cat "${dir}/prs.json" ;;
  *compare*) echo 0 ;;
  *"labels=agent:waiting-quota"*) echo 694 ;;
  *"issues/694 "*) echo false ;;
esac
`,
  );
  chmodSync(join(dir, "gh"), 0o755);
  const run = spawnSync("bash", [join(dir, "merge-sweep.sh")], {
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: `${dir}:${process.env.PATH}`,
      GITHUB_REPOSITORY: "owner/repo",
      DRY_RUN: "1",
      BOT_TOKEN: "bot",
      PAT_TOKEN: "pat",
      EVENT: event,
    },
  });
  expect(run.status).toBe(0);
  return run.stdout + run.stderr;
}

it("sends a conflicting PR without any CI run back to Claude (#713)", () => {
  expect(sweep("CONFLICTING", [])).toContain("agents:conflict sha=abcdef1");
});

it("sends a conflicting PR whose CI is still running back to Claude (#713)", () => {
  expect(sweep("CONFLICTING", [pending])).toContain("agents:conflict sha=abcdef1");
});

it("leaves a mergeable PR without any CI run alone (#713)", () => {
  const out = sweep("MERGEABLE", []);
  expect(out).not.toContain("agents:conflict");
  expect(out).not.toContain("Merging #70");
});

it("looks again at a PR whose mergeability is not computed yet (#713)", () => {
  const out = sweep("UNKNOWN", [green]);
  expect(out).not.toContain("agents:conflict");
  expect(out).not.toContain("Merging #70");
});

it("retries the issues waiting for quota on a manual run, the hourly cron being unreliable (#736)", () => {
  expect(sweep("MERGEABLE", [], "workflow_dispatch")).toContain("Retrying #694");
  expect(sweep("MERGEABLE", [], "schedule")).toContain("Retrying #694");
  expect(sweep("MERGEABLE", [])).not.toContain("Retrying #694");
});
