import { spawnSync } from "node:child_process";
import { chmodSync, copyFileSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { expect, it } from "vitest";

type Check = {
  __typename: string;
  name: string;
  status: string;
  conclusion: string | null;
  detailsUrl?: string;
};
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
function sweep(
  mergeable: string,
  checks: Check[],
  event = "workflow_run",
  log = "",
  {
    milestone = null,
    milestones = "",
    files = [],
    onMain = "",
  }: {
    milestone?: { title: string } | null;
    milestones?: string;
    files?: { path: string }[];
    onMain?: string;
  } = {},
) {
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
    milestone,
    files,
    statusCheckRollup: checks,
  };
  writeFileSync(join(dir, "prs.json"), JSON.stringify([pr]));
  writeFileSync(join(dir, "job.log"), log);
  writeFileSync(join(dir, "milestones.txt"), milestones);
  writeFileSync(join(dir, "main.txt"), onMain);
  writeFileSync(
    join(dir, "gh"),
    `#!/usr/bin/env bash
case "$*" in
  *"pr list"*) cat "${dir}/prs.json" ;;
  *compare*) echo 0 ;;
  *milestones*) cat "${dir}/milestones.txt" ;;
  *contents/supabase/migrations*) cat "${dir}/main.txt" ;;
  *"run view"*) cat "${dir}/job.log" ;;
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

const red: Check = {
  __typename: "CheckRun",
  name: "shots",
  status: "COMPLETED",
  conclusion: "FAILURE",
  detailsUrl: "https://github.com/owner/repo/actions/runs/4321/job/8765",
};

it("reruns a check that failed on a GitHub outage once, without Claude (#1012)", () => {
  const out = sweep(
    "MERGEABLE",
    [red],
    "workflow_run",
    "fatal: unable to access 'https://github.com/owner/repo/': The requested URL returned error: 503",
  );
  expect(out).toContain("gh run rerun 4321 --failed");
  expect(out).toContain("agents:rerun sha=abcdef1");
  expect(out).not.toContain("agents:fix");
});

it("sends a check that failed on the code back to Claude (#1012)", () => {
  const out = sweep("MERGEABLE", [red], "workflow_run", "AssertionError: expected 2 to be 3");
  expect(out).toContain("agents:fix sha=abcdef1");
  expect(out).not.toContain("gh run rerun");
});

const v20 = "v0.20 Done\t0\nv0.21 Next\t3\n";

it("holds a green PR of a later version until the tag of the current one (#1062)", () => {
  const out = sweep("MERGEABLE", [green], "workflow_run", "", {
    milestone: { title: "v0.21 Next" },
    milestones: v20,
  });
  expect(out).toContain("#70 (v0.21 Next) waits for the tag of v0.20 Done");
  expect(out).toContain("labels[]=agent:held");
  expect(out).not.toContain("Merging #70");
});

it("merges a green PR of the version to tag (#1062)", () => {
  const out = sweep("MERGEABLE", [green], "workflow_run", "", {
    milestone: { title: "v0.20 Done" },
    milestones: v20,
  });
  expect(out).not.toContain("agent:held\n");
  expect(out).toContain("Merging #70");
});

it("sends back a PR whose new migration comes before main's last one (#1095)", () => {
  const out = sweep("MERGEABLE", [green], "workflow_run", "", {
    files: [{ path: "supabase/migrations/20261122150000_jokers.sql" }],
    onMain: "20261122140000_a.sql\n20261122160000_b.sql\n",
  });
  expect(out).toContain("agents:migration sha=abcdef1");
  expect(out).toContain("20261122150000_jokers.sql");
  expect(out).not.toContain("Merging #70");
});

it("merges a PR whose new migration comes after main's last one (#1095)", () => {
  const out = sweep("MERGEABLE", [green], "workflow_run", "", {
    files: [{ path: "supabase/migrations/20261122170000_jokers.sql" }],
    onMain: "20261122140000_a.sql\n20261122160000_b.sql\n",
  });
  expect(out).not.toContain("agents:migration");
  expect(out).toContain("Merging #70");
});
