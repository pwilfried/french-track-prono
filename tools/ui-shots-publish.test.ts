import { execFileSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { expect, it } from "vitest";

const script = resolve("ci/ui-shots-publish.sh");
const git = (cwd: string, args: string) =>
  execFileSync("bash", ["-c", `git -c user.name=t -c user.email=t@example.test ${args}`], {
    cwd,
    encoding: "utf8",
  });
const executable = (path: string, body: string) => {
  writeFileSync(path, `#!/usr/bin/env bash\n${body}\n`);
  chmodSync(path, 0o755);
};

it("publishes the shots when another PR pushed to boards after the fetch (#556)", () => {
  const root = mkdtempSync(join(tmpdir(), "ui-shots-"));
  const origin = join(root, "origin.git");
  git(root, "init -q --bare origin.git");
  git(root, "init -q seed");
  git(join(root, "seed"), "checkout -q -b boards");
  git(join(root, "seed"), "commit -q --allow-empty -m init");
  git(join(root, "seed"), `push -q ${origin} boards`);
  git(root, `clone -q ${origin} work`);
  const work = join(root, "work");

  // The script's checkout of boards lets another PR push to it first, once.
  executable(
    join(work, ".git/hooks/post-checkout"),
    `[ -e "${root}/pushed" ] && exit 0; touch "${root}/pushed"
unset $(git rev-parse --local-env-vars)
other=$(mktemp -d) && git clone -q -b boards "${origin}" "$other"
git -C "$other" -c user.name=o -c user.email=o@example.test commit -q --allow-empty -m "other PR"
git -C "$other" push -q origin boards`,
  );
  // gh: the PR body names the issue; no comment exists yet.
  const bin = join(root, "bin");
  mkdirSync(bin);
  executable(join(bin, "gh"), `[ "$1 $2" = "pr view" ] && echo "Closes #42"; exit 0`);
  const shots = join(root, "shots");
  mkdirSync(shots);
  writeFileSync(join(shots, "home-light.png"), "light");
  writeFileSync(join(shots, "home-dark.png"), "dark");

  execFileSync("bash", [script], {
    cwd: work,
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: `${bin}:${process.env.PATH}`,
      GH_TOKEN: "x",
      GITHUB_REPOSITORY: "owner/repo",
      PR: "7",
      HEAD_SHA: "abcdef1234",
      SHOTS: shots,
    },
  });

  expect(git(root, `--git-dir ${origin} log boards --format=%s`).split("\n")).toEqual(
    expect.arrayContaining(["chore: ui-shots of #7", "other PR"]),
  );
  expect(git(root, `--git-dir ${origin} ls-tree -r boards --name-only`)).toContain(
    "issue-42/shots/home-light.png",
  );
});
