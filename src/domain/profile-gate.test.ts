import { describe, expect, it } from "vitest";

import { adminLanding, requiresProfile } from "./profile-gate";

describe("requiresProfile", () => {
  it.each(["/", "/epreuves", "/epreuves/100m-hommes", "/profil", "/bienvenuex"])(
    "needs a profile on %s",
    (path) => expect(requiresProfile(path)).toBe(true),
  );

  it.each([
    "/bienvenue",
    "/connexion",
    "/auth/callback",
    "/auth/sign-out",
    "/mentions-legales",
    "/confidentialite",
  ])("does not need a profile on %s", (path) => expect(requiresProfile(path)).toBe(false));
});

describe("adminLanding", () => {
  it.each(["/", "/epreuves", "/profil", "/ligues/creer", "/administration"])(
    "sends an admin who signs in for %s to the back-office",
    (path) => expect(adminLanding(path)).toBe("/admin/tableau-de-bord"),
  );

  it.each(["/admin", "/admin/competitions", "/admin/bareme?x=1"])(
    "keeps the back-office page %s an admin asked for",
    (path) => expect(adminLanding(path)).toBe(path),
  );
});
