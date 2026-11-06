import { describe, expect, it } from "vitest";

import { requiresProfile } from "./profile-gate";

describe("requiresProfile", () => {
  it.each(["/", "/epreuves", "/epreuves/100m-hommes", "/profil", "/bienvenuex"])(
    "needs a profile on %s",
    (path) => expect(requiresProfile(path)).toBe(true),
  );

  it.each(["/bienvenue", "/connexion", "/auth/callback", "/auth/sign-out"])(
    "does not need a profile on %s",
    (path) => expect(requiresProfile(path)).toBe(false),
  );
});
