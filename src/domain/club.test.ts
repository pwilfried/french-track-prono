import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  formatClubName,
  isAthleticsClubName,
  likelyDuplicate,
  matchesClub,
  searchKey,
} from "./club";

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

describe("likely duplicate club", () => {
  const acbb = {
    id: "acbb",
    name: "Athletic Club de Boulogne Billancourt (ACBB)",
    city: "Boulogne-Billancourt",
    department: "92",
    validated: true,
  };
  const sceaux = {
    id: "s",
    name: "Étoile de Sceaux",
    city: "Sceaux",
    department: "92",
    validated: true,
  };
  const lyon = {
    id: "l",
    name: "Club de Boulogne",
    city: "Lyon",
    department: "69",
    validated: true,
  };

  it("finds the imported club a player typed under a shorter name in the same department", () => {
    const typed = {
      id: "t",
      name: "AC Boulogne",
      city: "Boulogne",
      department: "92",
      validated: false,
    };
    expect(likelyDuplicate(typed, [acbb, sceaux, lyon, typed])?.id).toBe("acbb");
  });

  it("finds a club of the same town even without the department", () => {
    const typed = {
      id: "t",
      name: "Les foulées de fictiville",
      city: "Fictiville",
      department: "",
      validated: false,
    };
    const real = {
      id: "r",
      name: "Foulées Fictiville",
      city: "FICTIVILLE",
      department: "69",
      validated: true,
    };
    expect(likelyDuplicate(typed, [real, typed])?.id).toBe("r");
  });

  it("ignores a club with the same words in another department and another town", () => {
    const typed = {
      id: "t",
      name: "Club de Boulogne",
      city: "Boulogne",
      department: "62",
      validated: false,
    };
    expect(likelyDuplicate(typed, [lyon, typed])).toBeNull();
  });

  it("does not match on generic words only", () => {
    const typed = {
      id: "t",
      name: "Athletic Club",
      city: "Sceaux",
      department: "92",
      validated: false,
    };
    expect(likelyDuplicate(typed, [sceaux, typed])).toBeNull();
  });

  it("prefers a validated club with the most words in common", () => {
    const typed = {
      id: "t",
      name: "Etoile Sceaux",
      city: "Sceaux",
      department: "92",
      validated: false,
    };
    const other = { ...typed, id: "o", name: "Étoile de Sceaux 92", validated: false };
    expect(likelyDuplicate(typed, [other, sceaux, typed])?.id).toBe("s");
  });
});
