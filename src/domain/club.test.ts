import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { formatClubName, isAthleticsClubName, matchesClub, searchKey } from "./club";

describe("formatClubName", () => {
  it.each([
    [
      "ATHLETIC CLUB DE BOULOGNE BILLANCOURT (ACBB)",
      "Athletic Club de Boulogne Billancourt (ACBB)",
    ],
    ["US CRETEIL ATHLETISME", "US Creteil Athletisme"],
    ["ASPTT STRASBOURG", "ASPTT Strasbourg"],
    ["STADE FRANÇAIS", "Stade Français"],
    ["CLUB D'ATHLETISME DE SAINT-ETIENNE", "Club d'Athletisme de Saint-Etienne"],
    ["C.A. MONTREUIL 93", "C.A. Montreuil 93"],
    ["  EA   PAU  ", "EA Pau"],
    ["LES FOULEES DU VAL", "Les Foulees du Val"],
    ["ENTENTE SPORTIVE DE BREST", "Entente Sportive de Brest"],
  ])("formats %j as %j", (raw, formatted) => expect(formatClubName(raw)).toBe(formatted));

  it("never changes the letters, only their case", () =>
    fc.assert(
      fc.property(
        fc.string(),
        (raw) => searchKey(formatClubName(raw)) === searchKey(raw.replace(/\s+/g, " ")),
      ),
    ));
});

describe("isAthleticsClubName", () => {
  it.each(["ATHLETIC CLUB DE BOULOGNE", "CLUB ATHLETIQUE DE MONTREUIL", "JOGGING CLUB DE SEVRES"])(
    "keeps %j",
    (name) => expect(isAthleticsClubName(name)).toBe(true),
  );
  it.each([
    "ATHLETIC CLUB HANDBALL DE NIMES",
    "CLUB ATHLETIQUE PETANQUE DE RODEZ",
    "ATHLETIC CYCLOTOURISME DE LYON",
    "CLUB ATHLETIQUE D'HALTEROPHILIE",
    "ATHLETIC FOOTBALL CLUB",
  ])("drops %j, another sport", (name) => expect(isAthleticsClubName(name)).toBe(false));
});

describe("matchesClub", () => {
  const club = {
    name: "Athletic Club de Boulogne Billancourt (ACBB)",
    city: "Boulogne-Billancourt",
  };

  it.each(["acbb", "ACBB", "boulogne", "bôulogne billan", "athletic boulogne"])(
    "finds the club with %j",
    (query) => expect(matchesClub(query, club)).toBe(true),
  );
  it.each(["", "  ", "montreuil", "acbb montreuil"])("does not find it with %j", (query) =>
    expect(matchesClub(query, club)).toBe(false),
  );
  it("finds a club by its town", () =>
    expect(matchesClub("Créteil", { name: "US Athlétisme", city: "Créteil" })).toBe(true));
});
