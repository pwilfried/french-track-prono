import { execFileSync } from "node:child_process";

import { describe, expect, it } from "vitest";

const closedBy = (bodies: string) =>
  execFileSync("bash", ["-c", ". ci/agents/lib.sh && closed_by"], {
    encoding: "utf8",
    input: bodies,
    env: { ...process.env, GITHUB_REPOSITORY: "owner/repo" },
  })
    .split("\n")
    .filter(Boolean);

describe("closed_by (ci/agents/lib.sh)", () => {
  it("lists the issues the PR bodies close, once each", () => {
    expect(closedBy("Closes #550\n\nfixes #12 and Resolved #7\nCloses #550\n")).toEqual([
      "12",
      "550",
      "7",
    ]);
  });

  it("ignores the issues a PR only refers to", () => {
    expect(closedBy("Refs #554, see #560\n")).toEqual([]);
  });
});
