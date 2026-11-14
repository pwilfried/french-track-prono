import { describe, expect, it } from "vitest";

import { isDemoEmail } from "./demo-player";

describe("demo accounts", () => {
  it.each(["demo-1@example.test", "Demo-12@Example.TEST", "  e2e-as-42@example.test "])(
    "takes %s for an invented account",
    (email) => {
      expect(isDemoEmail(email)).toBe(true);
    },
  );

  it.each([
    "someone@gmail.com",
    "demo@example.test.evil.com",
    "demo@sub.example.test",
    "example.test",
    "@example.test",
    "demo@example.testing",
    "",
  ])("refuses %s, which may be a real account", (email) => {
    expect(isDemoEmail(email)).toBe(false);
  });
});
