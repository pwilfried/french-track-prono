import { spawnSync } from "node:child_process";
import { expect, it } from "vitest";

// Git skips a hook that is not executable, with only a hint (#559).
function prePush(remoteRef: string) {
  return spawnSync(".githooks/pre-push", ["origin", "url"], {
    input: `refs/heads/work 1111 ${remoteRef} 0000\n`,
  });
}

it("refuses a push to main", () => {
  expect(prePush("refs/heads/main").status).toBe(1);
});

it("lets a branch be pushed", () => {
  expect(prePush("refs/heads/fix/1-something").status).toBe(0);
});
