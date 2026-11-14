import { describe, expect, it } from "vitest";

import { vercelBypassHeaders } from "./database";

describe("vercelBypassHeaders", () => {
  it("gives the Vercel protection bypass header when the secret is set", () => {
    expect(vercelBypassHeaders({ VERCEL_AUTOMATION_BYPASS_SECRET: "s3cret" })).toEqual({
      "x-vercel-protection-bypass": "s3cret",
    });
  });

  it.each([{}, { VERCEL_AUTOMATION_BYPASS_SECRET: "" }])(
    "gives no header without a secret",
    (env) => {
      expect(vercelBypassHeaders(env)).toEqual({});
    },
  );
});
