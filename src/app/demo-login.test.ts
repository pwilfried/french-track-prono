import { describe, expect, it } from "vitest";

import { demoLoginEnabled, demoPseudoFrom } from "./demo-login";

describe("the pre-production switch of the demo sign-in", () => {
  it("is on only when PREPROD_DEMO_LOGIN is 1", () => {
    expect(demoLoginEnabled({ PREPROD_DEMO_LOGIN: "1" })).toBe(true);
  });

  it.each([{}, { PREPROD_DEMO_LOGIN: "" }, { PREPROD_DEMO_LOGIN: "true" }])(
    "is off in production, where the variable is absent (%o)",
    (env) => {
      expect(demoLoginEnabled(env)).toBe(false);
    },
  );
});

describe("the pseudo shown by the demo banner", () => {
  it("is read from its cookie among the others", () => {
    expect(demoPseudoFrom("a=1; ftp-demo-as=D%C3%A9mo%20Gazelle; b=2")).toBe("Démo Gazelle");
  });

  it("is absent outside a demo session", () => {
    expect(demoPseudoFrom("a=1; b=2")).toBeNull();
    expect(demoPseudoFrom("")).toBeNull();
  });
});
