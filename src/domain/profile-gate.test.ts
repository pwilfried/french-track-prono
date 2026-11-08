import { describe, expect, it } from "vitest";

import { requiresProfile, sendsAdminToBackOffice } from "./profile-gate";

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

describe("sendsAdminToBackOffice", () => {
  it.each(["/", "/epreuves", "/profil", "/ligues/creer", "/regles", "/administration"])(
    "sends an admin from %s to the back-office",
    (path) => expect(sendsAdminToBackOffice(path)).toBe(true),
  );

  it.each(["/admin", "/admin/competitions", "/auth/sign-out", "/connexion", "/bienvenue"])(
    "lets an admin open %s",
    (path) => expect(sendsAdminToBackOffice(path)).toBe(false),
  );
});
