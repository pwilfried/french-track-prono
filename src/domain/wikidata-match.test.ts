import { describe, expect, it } from "vitest";

import {
  countryIdsOf,
  iocCodeOf,
  matchWikidata,
  nameKey,
  type WikidataEntity,
  type WikidataStatement,
} from "./wikidata-match";

const item = (id: string): WikidataStatement => ({
  rank: "normal",
  mainsnak: { snaktype: "value", datavalue: { type: "wikibase-entityid", value: { id } } },
});

const MALE = "Q6581097";
const FEMALE = "Q6581072";
const NON_BINARY = "Q48270";

/** A human athlete of Wikidata, as wbgetentities gives it (only the read fields). */
function athlete(
  id: string,
  label: string,
  options: {
    sex?: string;
    sportsCountry?: string;
    citizenship?: string;
    aliases?: string[];
    labelLanguage?: string;
    sport?: string;
  } = {},
): WikidataEntity {
  return {
    id,
    labels: { [options.labelLanguage ?? "en"]: { value: label } },
    aliases: { en: (options.aliases ?? []).map((value) => ({ value })) },
    claims: {
      P31: [item("Q5")],
      P641: [item(options.sport ?? "Q542")],
      P21: [item(options.sex ?? MALE)],
      ...(options.sportsCountry ? { P1532: [item(options.sportsCountry)] } : {}),
      P27: [item(options.citizenship ?? "Q28")],
    },
  };
}

// Country items and their IOC codes (P984): Hungary, USA, Poland, United Kingdom, Wales.
const IOC = new Map([
  ["Q28", "HUN"],
  ["Q30", "USA"],
  ["Q36", "POL"],
  ["Q145", "GBR"],
]);

describe("matchWikidata", () => {
  it("links the only candidate whose label is our name, accents and case ignored", () => {
    const tamberi = athlete("Q1", "Gianmarco Tamberi", { citizenship: "Q28" });
    expect(
      matchWikidata({ name: "GIANMARCO TAMBERI", countryCode: "HUN", gender: "M" }, [tamberi], IOC),
    ).toEqual({ status: "linked", id: "Q1" });
  });

  it("asks the admin when two namesakes are left (Molnár)", () => {
    const older = athlete("Q10", "Attila Molnár");
    const younger = athlete("Q11", "Attila Molnár");
    expect(
      matchWikidata(
        { name: "Attila Molnar", countryCode: "HUN", gender: "M" },
        [older, younger],
        IOC,
      ),
    ).toEqual({ status: "to_review", candidateIds: ["Q10", "Q11"] });
  });

  it("drops a search result whose label and aliases are not our name (Bednarek, not Bacon)", () => {
    const bednarek = athlete("Q20", "Kenny Bednarek", { citizenship: "Q30" });
    const bacon = athlete("Q21", "Jaylen Bacon", { citizenship: "Q30" });
    expect(
      matchWikidata(
        { name: "Kenny Bednarek", countryCode: "USA", gender: "M" },
        [bacon, bednarek],
        IOC,
      ),
    ).toEqual({ status: "linked", id: "Q20" });
  });

  it("asks the admin when only an alias is our name (Kaczmarek for Bukowiecka)", () => {
    const kaczmarek = athlete("Q30", "Natalia Kaczmarek", {
      sex: FEMALE,
      citizenship: "Q36",
      aliases: ["Natalia Bukowiecka"],
    });
    expect(
      matchWikidata(
        { name: "Natalia Bukowiecka", countryCode: "POL", gender: "F" },
        [kaczmarek],
        IOC,
      ),
    ).toEqual({ status: "to_review", candidateIds: ["Q30"] });
  });

  it("reads the citizenship when the sports country has no IOC code (Azu, Wales)", () => {
    const azu = athlete("Q40", "Jeremiah Azu", { sportsCountry: "Q25", citizenship: "Q145" });
    expect(
      matchWikidata({ name: "Jeremiah Azu", countryCode: "GBR", gender: "M" }, [azu], IOC),
    ).toEqual({ status: "linked", id: "Q40" });
  });

  it("prefers the sports country over the citizenship when it has an IOC code", () => {
    const athleteOfHungary = athlete("Q41", "Some Runner", {
      sportsCountry: "Q28",
      citizenship: "Q30",
    });
    expect(
      matchWikidata(
        { name: "Some Runner", countryCode: "USA", gender: "M" },
        [athleteOfHungary],
        IOC,
      ),
    ).toEqual({ status: "to_review", candidateIds: [] });
  });

  it("keeps a non-binary athlete in our F or M category (Hiltz)", () => {
    const hiltz = athlete("Q50", "Nikki Hiltz", { sex: NON_BINARY, citizenship: "Q30" });
    expect(
      matchWikidata({ name: "Nikki Hiltz", countryCode: "USA", gender: "F" }, [hiltz], IOC),
    ).toEqual({ status: "linked", id: "Q50" });
  });

  it("drops a candidate of the opposite sex", () => {
    const man = athlete("Q51", "Jordan Smith", { sex: MALE, citizenship: "Q30" });
    expect(
      matchWikidata({ name: "Jordan Smith", countryCode: "USA", gender: "F" }, [man], IOC),
    ).toEqual({ status: "to_review", candidateIds: [] });
  });

  it("drops a namesake who is not an athletics athlete (a bobsledder)", () => {
    const runner = athlete("Q60", "Jasmine Jones", { sex: FEMALE, citizenship: "Q30" });
    const bobsledder = athlete("Q61", "Jasmine Jones", {
      sex: FEMALE,
      citizenship: "Q30",
      sport: "Q177275",
    });
    expect(
      matchWikidata(
        { name: "Jasmine Jones", countryCode: "USA", gender: "F" },
        [bobsledder, runner],
        IOC,
      ),
    ).toEqual({ status: "linked", id: "Q60" });
  });

  it("keeps an athlete known by the occupation of athletics competitor only", () => {
    const runner = athlete("Q62", "Ana Pérez", { sex: FEMALE, sport: "Q2736" });
    runner.claims!.P106 = [item("Q11513337")];
    expect(
      matchWikidata({ name: "Ana Perez", countryCode: "HUN", gender: "F" }, [runner], IOC),
    ).toEqual({ status: "linked", id: "Q62" });
  });

  it("reads the French and the mul labels when there is no English one", () => {
    const fr = athlete("Q70", "Mondo Duplantis", { labelLanguage: "fr" });
    const mul = athlete("Q71", "Pál Kovács", { labelLanguage: "mul" });
    expect(
      matchWikidata({ name: "Mondo Duplantis", countryCode: "HUN", gender: "M" }, [fr], IOC),
    ).toEqual({ status: "linked", id: "Q70" });
    expect(
      matchWikidata({ name: "Pal Kovacs", countryCode: "HUN", gender: "M" }, [mul], IOC),
    ).toEqual({ status: "linked", id: "Q71" });
  });

  it("shows the plausible athletes to the admin when none bears our name", () => {
    const other = athlete("Q80", "Georgia Bell", { sex: FEMALE, citizenship: "Q145" });
    expect(
      matchWikidata({ name: "Georgia Hunter Bell", countryCode: "GBR", gender: "F" }, [other], IOC),
    ).toEqual({ status: "to_review", candidateIds: ["Q80"] });
  });

  it("counts a candidate found twice (English then French search) once", () => {
    const one = athlete("Q90", "Femke Bol", { sex: FEMALE });
    expect(
      matchWikidata({ name: "Femke Bol", countryCode: "HUN", gender: "F" }, [one, one], IOC),
    ).toEqual({ status: "linked", id: "Q90" });
  });

  it("asks the admin when the search found nothing", () => {
    expect(matchWikidata({ name: "Nobody", countryCode: "FRA", gender: "M" }, [], IOC)).toEqual({
      status: "to_review",
      candidateIds: [],
    });
  });
});

describe("nameKey", () => {
  it("ignores accents, case, dashes and letters without a decomposition", () => {
    expect(nameKey("  Łukasz  ŻYWIEC-Ødegård ")).toBe("lukasz zywiec odegard");
    expect(nameKey("Attila Molnár")).toBe(nameKey("attila molnar"));
  });
});

describe("countries", () => {
  it("lists the sports countries and citizenships of an entity", () => {
    const azu = athlete("Q40", "Jeremiah Azu", { sportsCountry: "Q25", citizenship: "Q145" });
    expect(countryIdsOf(azu)).toEqual(["Q25", "Q145"]);
  });

  it("reads the IOC code of a country item", () => {
    const sweden: WikidataEntity = {
      id: "Q34",
      claims: {
        P984: [
          {
            rank: "normal",
            mainsnak: { snaktype: "value", datavalue: { type: "string", value: "SWE" } },
          },
        ],
      },
    };
    expect(iocCodeOf(sweden)).toBe("SWE");
    expect(iocCodeOf({ id: "Q25", claims: {} })).toBeNull();
  });
});
