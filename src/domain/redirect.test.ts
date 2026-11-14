import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { eventReturnPath, eventSlugOfPath, safeRedirectPath } from "./redirect";

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

describe("eventReturnPath", () => {
  it("keeps the page of an event", () => {
    expect(eventReturnPath("/epreuves/100m-femmes")).toBe("/epreuves/100m-femmes");
    expect(eventReturnPath("/epreuves/100m-femmes/")).toBe("/epreuves/100m-femmes");
    expect(eventReturnPath("/epreuves/100m-femmes#podium")).toBe("/epreuves/100m-femmes");
  });

  it.each([
    undefined,
    null,
    "",
    "/competitions",
    "/epreuves",
    "/epreuves/a/b",
    "https://evil.test/epreuves/x",
    "//evil.test/epreuves/x",
    "/\\evil.test/epreuves/x",
    "javascript:alert(1)",
  ])("refuses %j", (input) => {
    expect(eventReturnPath(input)).toBeNull();
  });

  it("only ever returns an event page of the app", () => {
    fc.assert(
      fc.property(fc.string(), (input) => {
        const out = eventReturnPath(input);
        if (out !== null) expect(out).toMatch(/^\/epreuves\/[^/?#\\]+$/);
      }),
    );
  });
});
