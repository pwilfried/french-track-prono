import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { eventSlugOfPath, safeRedirectPath } from "./redirect";

describe("eventSlugOfPath", () => {
  it.each([
    ["/epreuves/100m-femmes", "100m-femmes"],
    ["/epreuves/100m-femmes?tab=resultat", "100m-femmes"],
    ["/epreuves/100m-femmes#podium", "100m-femmes"],
    ["/epreuves/100m-femmes/", "100m-femmes"],
  ])("finds the event of %j", (path, slug) => {
    expect(eventSlugOfPath(path)).toBe(slug);
  });

  it.each(["/", "/epreuves", "/epreuves/", "/profil", "/epreuves/a/b", "/ligues/epreuves/a"])(
    "finds no event in %j",
    (path) => {
      expect(eventSlugOfPath(path)).toBeNull();
    },
  );
});

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
    expect(safeRedirectPath(input)).toBe("/");
  });

  it("falls back when the value is missing", () => {
    expect(safeRedirectPath(null)).toBe("/");
    expect(safeRedirectPath(undefined)).toBe("/");
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
