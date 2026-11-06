import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { safeRedirectPath } from "./redirect";

describe("safeRedirectPath", () => {
  it("keeps a path inside the app", () => {
    expect(safeRedirectPath("/epreuves/100m-hommes")).toBe("/epreuves/100m-hommes");
  });

  it("keeps the query string of an in-app path", () => {
    expect(safeRedirectPath("/epreuves?genre=F")).toBe("/epreuves?genre=F");
  });

  it.each([
    "//evil.test",
    "https://evil.test",
    "http://evil.test/x",
    "/\\evil",
    "\\evil",
    "javascript:alert(1)",
    "epreuves",
    "",
    "/\tevil",
    "/%2F/evil",
  ])("refuses %j and falls back", (input) => {
    expect(safeRedirectPath(input)).toBe("/epreuves");
  });

  it("falls back when the value is missing", () => {
    expect(safeRedirectPath(null)).toBe("/epreuves");
    expect(safeRedirectPath(undefined)).toBe("/epreuves");
  });

  it("uses the given fallback", () => {
    expect(safeRedirectPath("//evil.test", "/profil")).toBe("/profil");
  });

  it("never returns something that is not an in-app path", () => {
    fc.assert(
      fc.property(fc.string(), (input) => {
        const out = safeRedirectPath(input);
        expect(out.startsWith("/")).toBe(true);
        expect(out.startsWith("//")).toBe(false);
        expect(out.includes("\\")).toBe(false);
        expect(new URL(out, "http://app.test").origin).toBe("http://app.test");
      }),
    );
  });
});
