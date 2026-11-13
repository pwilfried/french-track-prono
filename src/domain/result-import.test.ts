import { describe, expect, it } from "vitest";

import { matchResults, parseResultsTable, type ResultRow } from "./result-import";

// Tables copied from World Athletics results pages, names replaced by invented ones.
const RACE = [
  "400 Metres Hurdles Men - Final",
  "Wind: +0.3 m/s",
  "POS\tBIB\tATHLETE\tCOUNTRY\tMARK\t",
  "1\t5\tKasper WALDHEIM\tNOR\t46.52\tWR",
  "2\t4\tRai BENTLEY\tUSA\t46.80\tAR",
  "3\t6\tAlvaro DOS SANTOS\tBRA\t47.01\tPB",
  "4\t3\tYasmani COPELLO\tTUR\t47.45\tSB",
  "5\t7\tMathieu LEMAÎTRE\tFRA\t48.12",
  "\t8\tAbderrahman SAMBARA\tQAT\tDNF\t",
  "\t2\tKyron McMASTERS\tIVB\tDNS",
  "\t1\tRasmus MAGI\tEST\tDQ\tTR22.6.2",
].join("\n");

const FIELD = [
  "Long Jump Women - Final",
  "Pos  Athlete  Country  Mark",
  "1.  Tara  DAVIDSEN  USA  7.12  SB",
  "2.  Malaika  MIHAMBO-KLEIN  GER  7.05",
  "=3  Ivana  SPANOVSKA  SRB  6.94  =PB",
  "=3  Larissa  IAPICHINI  ITA  6.94  NR",
  "  Quanesha  BURKS  USA  NM",
].join("\n");

describe("parseResultsTable", () => {
  it("reads a race copied with tabs: place, name, country, time, records and DNS / DNF / DQ", () => {
    expect(parseResultsTable(RACE)).toEqual<ResultRow[]>([
      {
        place: 1,
        name: "Kasper WALDHEIM",
        countryCode: "NOR",
        status: "ok",
        mark: "46.52",
        records: ["wr"],
      },
      {
        place: 2,
        name: "Rai BENTLEY",
        countryCode: "USA",
        status: "ok",
        mark: "46.80",
        records: ["ar"],
      },
      {
        place: 3,
        name: "Alvaro DOS SANTOS",
        countryCode: "BRA",
        status: "ok",
        mark: "47.01",
        records: ["pb"],
      },
      {
        place: 4,
        name: "Yasmani COPELLO",
        countryCode: "TUR",
        status: "ok",
        mark: "47.45",
        records: ["sb"],
      },
      {
        place: 5,
        name: "Mathieu LEMAÎTRE",
        countryCode: "FRA",
        status: "ok",
        mark: "48.12",
        records: [],
      },
      {
        place: null,
        name: "Abderrahman SAMBARA",
        countryCode: "QAT",
        status: "dnf",
        mark: null,
        records: [],
      },
      {
        place: null,
        name: "Kyron McMASTERS",
        countryCode: "IVB",
        status: "dns",
        mark: null,
        records: [],
      },
      {
        place: null,
        name: "Rasmus MAGI",
        countryCode: "EST",
        status: "dq",
        mark: null,
        records: [],
      },
    ]);
  });

  it("reads a field event copied with spaces: distances, ties sharing their place, no mark", () => {
    expect(parseResultsTable(FIELD)).toEqual<ResultRow[]>([
      {
        place: 1,
        name: "Tara DAVIDSEN",
        countryCode: "USA",
        status: "ok",
        mark: "7.12",
        records: ["sb"],
      },
      {
        place: 2,
        name: "Malaika MIHAMBO-KLEIN",
        countryCode: "GER",
        status: "ok",
        mark: "7.05",
        records: [],
      },
      {
        place: 3,
        name: "Ivana SPANOVSKA",
        countryCode: "SRB",
        status: "ok",
        mark: "6.94",
        records: ["pb"],
      },
      {
        place: 3,
        name: "Larissa IAPICHINI",
        countryCode: "ITA",
        status: "ok",
        mark: "6.94",
        records: ["nr"],
      },
      {
        place: null,
        name: "Quanesha BURKS",
        countryCode: "USA",
        status: "dnf",
        mark: null,
        records: [],
      },
    ]);
  });

  it("keeps a long time, drops the date of birth and a three-letter surname is not the country", () => {
    expect(
      parseResultsTable(
        [
          "1\tJakob INGEBRIGSEN\t19 SEP 2000\tNOR\t3:28.32\tMR, SB\t0.145",
          "2\tWon LEE\t04 MAR 1999\tMAR\t3:29.01",
          "3 Hana WEKESA KEN 2:07:12 PB 1213",
          "DNF Tomas KLEIN CZE",
        ].join("\n"),
      ),
    ).toEqual<ResultRow[]>([
      {
        place: 1,
        name: "Jakob INGEBRIGSEN",
        countryCode: "NOR",
        status: "ok",
        mark: "3:28.32",
        records: ["sb"],
      },
      { place: 2, name: "Won LEE", countryCode: "MAR", status: "ok", mark: "3:29.01", records: [] },
      {
        place: 3,
        name: "Hana WEKESA",
        countryCode: "KEN",
        status: "ok",
        mark: "2:07:12",
        records: ["pb"],
      },
      {
        place: null,
        name: "Tomas KLEIN",
        countryCode: "CZE",
        status: "dnf",
        mark: null,
        records: [],
      },
    ]);
  });

  it("ignores headers, titles, wind and blank lines, and finds nothing in a text without results", () => {
    expect(parseResultsTable("Results\n\nPos\tAthlete\tCountry\tMark\nWind: -0.2\n")).toEqual([]);
    expect(parseResultsTable("")).toEqual([]);
  });
});

describe("matchResults", () => {
  const entries = [
    { athleteId: "a", name: "Mathieu Lemaître", countryCode: "FRA" },
    { athleteId: "b", name: "Kasper Waldheim", countryCode: "NOR" },
    { athleteId: "c", name: "Rai Bentley", countryCode: "USA" },
  ];
  const row = (name: string, countryCode: string | null, place: number): ResultRow => ({
    place,
    name,
    countryCode,
    status: "ok",
    mark: "47.00",
    records: [],
  });

  it("recognises a name with an accent in the base and none in the text, in capitals, any order", () => {
    const { lines, unmatched } = matchResults(
      [row("Mathieu LEMAITRE", "FRA", 1), row("WALDHEIM Kasper", "NOR", 2)],
      entries,
    );
    expect(lines.map((l) => [l.athleteId, l.place])).toEqual([
      ["a", 1],
      ["b", 2],
    ]);
    expect(unmatched).toEqual([]);
  });

  it("does not take a namesake from another country, and lists the lines it does not know apart", () => {
    const stranger = row("Kasper Waldheim", "DEN", 1);
    const unknown = row("Somebody ELSE", "USA", 2);
    const { lines, unmatched } = matchResults(
      [stranger, unknown, row("Rai Bentley", null, 3)],
      entries,
    );
    expect(lines.map((l) => l.athleteId)).toEqual(["c"]);
    expect(unmatched).toEqual([stranger, unknown]);
  });

  it("turns a row into a performance and keeps only the first line of an athlete", () => {
    const first: ResultRow = {
      place: null,
      name: "Rai BENTLEY",
      countryCode: "USA",
      status: "dnf",
      mark: null,
      records: [],
    };
    const again = row("Rai Bentley", "USA", 4);
    expect(matchResults([first, again], entries)).toEqual({
      lines: [{ athleteId: "c", status: "dnf", place: null, mark: null, records: [] }],
      unmatched: [again],
    });
  });
});
