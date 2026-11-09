import { describe, expect, it } from "vitest";

import { isActive, MOBILE_NAV } from "./nav-items";

describe("MOBILE_NAV", () => {
  it("has the leagues between the ranking and the profile", () => {
    expect(MOBILE_NAV.map((item) => item.href)).toEqual([
      "/",
      "/epreuves",
      "/classement",
      "/ligues",
      "/profil",
    ]);
  });

  it("keeps the leagues tab active on a league page", () => {
    expect(isActive("/ligues", "/ligues/abc")).toBe(true);
    expect(isActive("/ligues", "/profil")).toBe(false);
  });
});
