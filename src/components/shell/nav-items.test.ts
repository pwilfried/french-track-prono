import { describe, expect, it } from "vitest";

import { desktopNav, isActive, mobileNav } from "./nav-items";

describe("mobileNav", () => {
  it("has five tabs for who sees the Manager, the Manager after the leagues and no profile", () => {
    expect(mobileNav(true).map((item) => item.href)).toEqual([
      "/",
      "/epreuves",
      "/classement",
      "/ligues",
      "/manager",
    ]);
  });

  it("has four tabs and no Manager for a player who does not see it", () => {
    expect(mobileNav(false).map((item) => item.href)).toEqual([
      "/",
      "/epreuves",
      "/classement",
      "/ligues",
    ]);
  });
});

describe("desktopNav", () => {
  it("leaves the Manager out for a player who does not see it", () => {
    expect(desktopNav(false).map((item) => item.href)).not.toContain("/manager");
    expect(desktopNav(true).map((item) => item.href)).toContain("/manager");
  });
});

describe("isActive", () => {
  it("keeps the Manager tab active on every Manager page", () => {
    expect(isActive("/manager", "/manager")).toBe(true);
    expect(isActive("/manager", "/manager/abc/catalogue")).toBe(true);
    expect(isActive("/manager", "/ligues")).toBe(false);
  });

  it("keeps the leagues tab active on a league page", () => {
    expect(isActive("/ligues", "/ligues/abc")).toBe(true);
    expect(isActive("/ligues", "/profil")).toBe(false);
  });
});
