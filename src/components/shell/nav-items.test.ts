import { describe, expect, it } from "vitest";

import { isActive, isItemActive, MOBILE_NAV } from "./nav-items";

describe("MOBILE_NAV", () => {
  it("has five tabs, the Manager after the leagues and no profile", () => {
    expect(MOBILE_NAV.map((item) => item.href)).toEqual([
      "/",
      "/competitions",
      "/classement",
      "/ligues",
      "/manager",
    ]);
  });

  it("keeps the Manager tab active on every Manager page", () => {
    expect(isActive("/manager", "/manager")).toBe(true);
    expect(isActive("/manager", "/manager/abc/catalogue")).toBe(true);
    expect(isActive("/manager", "/ligues")).toBe(false);
  });

  it("keeps the leagues tab active on a league page", () => {
    expect(isActive("/ligues", "/ligues/abc")).toBe(true);
    expect(isActive("/ligues", "/profil")).toBe(false);
  });

  it("keeps the competitions tab active on an event page", () => {
    const competitions = MOBILE_NAV[1]!;
    expect(isItemActive(competitions, "/competitions")).toBe(true);
    expect(isItemActive(competitions, "/epreuves/f-100m")).toBe(true);
    expect(isItemActive(competitions, "/classement")).toBe(false);
  });
});
