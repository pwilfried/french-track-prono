import { describe, expect, it } from "vitest";

import { athleteSlug, importReport, levenshtein, parseStartListCsv } from "./start-list-import";

describe("parseStartListCsv", () => {
  it("reads a header in any order, with commas", () => {
    expect(
      parseStartListCsv("Pays,Nom,SB\nUSA,Sha'Carri Richardson,10.71\nLCA,Julien Alfred,10.75"),
    ).toEqual({
      rows: [
        { name: "Sha'Carri Richardson", countryCode: "USA", seasonBest: "10.71" },
        { name: "Julien Alfred", countryCode: "LCA", seasonBest: "10.75" },
      ],
    });
  });

  it("detects tabs and semicolons, and guesses the columns without a header", () => {
    expect(parseStartListCsv("RICHARDSON Sha'carri\tUSA\t10.71")).toEqual({
      rows: [{ name: "RICHARDSON Sha'carri", countryCode: "USA", seasonBest: "10.71" }],
    });
    expect(parseStartListCsv("Julien Alfred;LCA")).toEqual({
      rows: [{ name: "Julien Alfred", countryCode: "LCA", seasonBest: null }],
    });
  });

  it("accepts a missing SB column and skips blank lines", () => {
    expect(parseStartListCsv("Nom,Pays\n\nJulien Alfred,LCA\n")).toEqual({
      rows: [{ name: "Julien Alfred", countryCode: "LCA", seasonBest: null }],
    });
  });

  it("explains an empty paste or a paste without names", () => {
    expect(parseStartListCsv("  \n ")).toEqual({ error: "CSV_EMPTY" });
    expect(parseStartListCsv("10.71,10.75\n10.80,10.82")).toEqual({ error: "CSV_NO_NAME" });
  });
});

describe("levenshtein", () => {
  it("counts the edits between two words", () => {
    expect(levenshtein("kitten", "sitting")).toBe(3);
    expect(levenshtein("", "abc")).toBe(3);
    expect(levenshtein("same", "same")).toBe(0);
  });
});

describe("importReport", () => {
  const candidates = [
    { athleteId: "1", name: "Sha'Carri Richardson", countryCode: "USA" },
    { athleteId: "2", name: "Julien Alfred", countryCode: "LCA" },
    { athleteId: "3", name: "Melissa Jefferson-Wooden", countryCode: "USA" },
    { athleteId: "4", name: "Tia Clayton", countryCode: "JAM" },
    { athleteId: "5", name: "Tina Clayton", countryCode: "JAM" },
    { athleteId: "6", name: "Gina Lückenkemper", countryCode: "GER" },
    { athleteId: "7", name: "Shericka Jackson", countryCode: "JAM" },
    { athleteId: "8", name: "Daryll Neita", countryCode: "GBR" },
  ];
  const row = (name: string) => ({ name, countryCode: null, seasonBest: null });

  it("matches seven fuzzy names out of eight and asks about the eighth", () => {
    const report = importReport(
      [
        row("RICHARDSON Sha'carri"),
        row("Alfred Julien"),
        row("Melissa Jefferson Wooden"),
        row("Gina Luckenkemper"),
        row("Shericka Jakson"),
        row("NEITA Daryl"),
        row("Julian Alfred"),
        row("T. Clayton"),
      ],
      candidates,
    );

    expect(report.map((l) => l.status)).toEqual([
      "matched",
      "matched",
      "matched",
      "matched",
      "matched",
      "matched",
      "matched",
      "ambiguous",
    ]);
    expect(report[0]).toMatchObject({ status: "matched", athlete: { athleteId: "1" } });
    expect(report[7]).toMatchObject({ choices: [{ athleteId: "4" }, { athleteId: "5" }] });
  });

  it("proposes to create an athlete nobody resembles", () => {
    expect(importReport([row("Gémima Joseph")], candidates)).toEqual([
      { row: row("Gémima Joseph"), status: "new" },
    ]);
  });
});

describe("athleteSlug", () => {
  it("turns a name into a slug without accents", () => {
    expect(athleteSlug("Gémima Joseph")).toBe("gemima-joseph");
    expect(athleteSlug("Sha'Carri  Richardson")).toBe("sha-carri-richardson");
  });
});
