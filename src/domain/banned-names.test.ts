import { describe, expect, it } from "vitest";

import { isBannedName } from "./banned-names";

describe("isBannedName", () => {
  it.each([
    "Ligue officielle",
    "OFFICIEL FrenchTrack",
    "La ligue FFA",
    "F F A des potes",
    "Les connards",
    "Bande de CONS",
    "Enculés du 100 m",
    "www.monsite.fr",
    "https //promo",
    "Gagne sur pari.com",
  ])("refuses %j", (name) => expect(isBannedName(name)).toBe(true));

  it.each([
    "Les Foulées",
    "Concorde AC",
    "Constance & co",
    "Les officiers du sprint ?",
    "Affalés",
    "Connor",
  ])("accepts %j", (name) => expect(isBannedName(name)).toBe(false));
});

describe("isBannedName on pseudos", () => {
  it.each(["SuperConnard", "le_con", "Officiel_FFA", "www_prono"])(
    "refuses the pseudo %j",
    (pseudo) => expect(isBannedName(pseudo)).toBe(true),
  );
});
