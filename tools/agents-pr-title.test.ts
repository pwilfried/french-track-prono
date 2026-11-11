import { execFileSync } from "node:child_process";

import { describe, expect, it } from "vitest";

const prTitle = (subject: string, title: string, labels: string) =>
  execFileSync("bash", ["-c", '. ci/agents/lib.sh && pr_title "$@"', "_", subject, title, labels], {
    encoding: "utf8",
    env: { ...process.env, GITHUB_REPOSITORY: "owner/repo" },
  }).trim();

describe("pr_title (ci/agents/lib.sh)", () => {
  it("keeps the first commit subject when it is conventional", () => {
    expect(prTitle("feat: answer the support form", "Improving Customer Service", "feature")).toBe(
      "feat: answer the support form",
    );
    expect(prTitle("fix(db)!: drop the grant", "Some bug", "bug")).toBe("fix(db)!: drop the grant");
  });

  it("prefixes the issue title with a type taken from its labels otherwise", () => {
    expect(prTitle("Update page.tsx", "Improving Customer Service", "feature,zone:app,p1")).toBe(
      "feat: Improving Customer Service",
    );
    expect(prTitle("", "Broken link", "zone:app,bug")).toBe("fix: Broken link");
    expect(prTitle("", "Explain the rules", "docs")).toBe("docs: Explain the rules");
    expect(prTitle("", "Tighten the rights", "zone:db,p1")).toBe("chore: Tighten the rights");
  });
});
