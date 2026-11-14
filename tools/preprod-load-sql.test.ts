import { spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { expect, it } from "vitest";

// Runs ci/preprod/load-sql.sh from the repository root with a fake curl that keeps each query sent.
function load(...files: string[]): string[] {
  const root = mkdtempSync(join(tmpdir(), "preprod-load-sql-"));
  const bin = join(root, "bin");
  mkdirSync(bin);
  const sent = join(root, "sent");
  writeFileSync(sent, "");
  writeFileSync(
    join(bin, "curl"),
    `#!/usr/bin/env bash\njq -r '.query | split("\\n")[0]' >> "${sent}"\n`,
  );
  chmodSync(join(bin, "curl"), 0o755);
  const run = spawnSync("bash", [resolve("ci/preprod/load-sql.sh"), ...files], {
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: `${bin}:${process.env.PATH}`,
      SUPABASE_ACCESS_TOKEN: "token",
      SUPABASE_PROJECT_REF: "ref",
    },
  });
  expect(run.status, run.stderr).toBe(0);
  return readFileSync(sent, "utf8").trim().split("\n");
}

const firstLine = (file: string) => readFileSync(file, "utf8").split("\n")[0];

it("loads the pre-production demo set right after the seed", () => {
  expect(load("supabase/seed.sql")).toEqual([
    firstLine("supabase/seed.sql"),
    firstLine("supabase/preprod/demo.sql"),
  ]);
});

it("loads any other file alone", () => {
  expect(load("ci/preprod/cleanup-e2e.sql")).toEqual([firstLine("ci/preprod/cleanup-e2e.sql")]);
});
