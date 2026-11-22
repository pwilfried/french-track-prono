import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  checkFunFact,
  closedToday,
  factsOfTheDay,
  FUN_FACT_BODY_MAX_LENGTH,
  FUN_FACT_TITLE_MAX_LENGTH,
  gameFigures,
  isFeatured,
  rulesFromScale,
  type FunFact,
  type FunFactDraft,
} from "./fun-facts";
import { DEFAULT_RULES } from "./scoring";

const fact = (id: string, tie: Partial<FunFact> = {}): FunFact => ({
  id,
  title: `Fait ${id}`,
  body: "Un fait vérifié.",
  tag: "oddity",
  competitionSlug: null,
  discipline: null,
  startsOn: null,
  endsOn: null,
  ...tie,
});

const draft = (change: Partial<FunFactDraft> = {}): FunFactDraft => ({
  ...fact("x"),
  source: "https://example.test/source",
  active: true,
  ...change,
});

const meeting = { slug: "meeting-test", startsOn: "2027-06-10", endsOn: "2027-06-12" };
const on = (day: string, disciplines: string[] = []) => ({
  day,
  competitions: [meeting],
  disciplines,
});

describe("checking a fact", () => {
  it("trims the texts and turns empty ties into none", () => {
    expect(
      checkFunFact(
        draft({ title: "  Titre ", body: " Corps ", competitionSlug: " ", startsOn: "" }),
      ),
    ).toMatchObject({ title: "Titre", body: "Corps", competitionSlug: null, startsOn: null });
  });

  it("refuses an empty or too long title or body", () => {
    expect(checkFunFact(draft({ title: " " }))).toEqual({ error: "FUN_FACT_TEXT_INVALID" });
    expect(checkFunFact(draft({ title: "a".repeat(FUN_FACT_TITLE_MAX_LENGTH + 1) }))).toEqual({
      error: "FUN_FACT_TEXT_INVALID",
    });
    expect(checkFunFact(draft({ body: "a".repeat(FUN_FACT_BODY_MAX_LENGTH + 1) }))).toEqual({
      error: "FUN_FACT_TEXT_INVALID",
    });
  });

  it("refuses an unknown tag", () => {
    expect(checkFunFact(draft({ tag: "other" as FunFact["tag"] }))).toEqual({
      error: "FUN_FACT_TAG_INVALID",
    });
  });

  it("refuses a date range that ends before it starts, or a date that is not one", () => {
    expect(checkFunFact(draft({ startsOn: "2027-06-12", endsOn: "2027-06-10" }))).toEqual({
      error: "FUN_FACT_DATES_INVALID",
    });
    expect(checkFunFact(draft({ startsOn: "demain" }))).toEqual({
      error: "FUN_FACT_DATES_INVALID",
    });
  });
});

describe("the facts of the day", () => {
  it("does not feature a fact tied to nothing", () => {
    expect(isFeatured(fact("a"), on("2027-06-11"))).toBe(false);
  });

  it("features a competition fact while the competition runs", () => {
    const f = fact("a", { competitionSlug: "meeting-test" });
    expect(isFeatured(f, on("2027-06-10"))).toBe(true);
    expect(isFeatured(f, on("2027-06-12"))).toBe(true);
    expect(isFeatured(f, on("2027-06-13"))).toBe(false);
  });

  it("features a fact within its dates, both included", () => {
    const f = fact("a", { startsOn: "2027-07-01", endsOn: "2027-07-02" });
    expect(isFeatured(f, on("2027-07-01"))).toBe(true);
    expect(isFeatured(f, on("2027-07-02"))).toBe(true);
    expect(isFeatured(f, on("2027-07-03"))).toBe(false);
  });

  it("features a discipline fact on a day with an event of that discipline", () => {
    const f = fact("a", { discipline: "100 m" });
    expect(isFeatured(f, on("2027-06-11", ["100 m"]))).toBe(true);
    expect(isFeatured(f, on("2027-06-11", ["Saut en longueur"]))).toBe(false);
  });

  it("shows a 100 m fact first on a Diamond League evening with a 100 m", () => {
    const sprint = fact("sprint", { competitionSlug: "meeting-test", discipline: "100 m" });
    const facts = [fact("a"), fact("b"), sprint, fact("c")];
    expect(factsOfTheDay(facts, on("2027-06-11", ["100 m"]))[0]!.id).toBe("sprint");
  });

  it("starts one fact further each day", () => {
    const facts = [fact("a"), fact("b"), fact("c")];
    const first = factsOfTheDay(facts, on("2027-01-01"))[0]!.id;
    const next = factsOfTheDay(facts, on("2027-01-02"))[0]!.id;
    expect(next).not.toBe(first);
  });

  it("is empty with an empty bank", () => {
    expect(factsOfTheDay([], on("2027-01-01"))).toEqual([]);
  });

  it("keeps every fact once, whatever the day", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 20 }), fc.integer({ min: 0, max: 3000 }), (n, d) => {
        const facts = Array.from({ length: n }, (_, i) =>
          fact(String(i), i % 3 === 0 ? { competitionSlug: "meeting-test" } : {}),
        );
        const day = new Date(Date.UTC(2026, 0, 1) + d * 86_400_000).toISOString().slice(0, 10);
        const ids = factsOfTheDay(facts, on(day)).map((f) => f.id);
        expect([...ids].sort()).toEqual(facts.map((f) => f.id).sort());
      }),
    );
  });
});

describe("closing the card", () => {
  it("hides it for the rest of the day it was closed, not the next one", () => {
    expect(closedToday("2027-06-11", "2027-06-11")).toBe(true);
    expect(closedToday("2027-06-11", "2027-06-12")).toBe(false);
    expect(closedToday(null, "2027-06-12")).toBe(false);
  });
});

describe("the facts about the game", () => {
  it("scores the podiums with the default scale", () => {
    expect(gameFigures(DEFAULT_RULES)).toEqual({
      exactSlot: DEFAULT_RULES.exactSlot,
      wrongPlace: DEFAULT_RULES.wrongPlace,
      perfectPodium: 3 * DEFAULT_RULES.exactSlot + DEFAULT_RULES.perfectPodium,
      markExact: DEFAULT_RULES.markExact,
    });
  });

  it("follows the admin's scale", () => {
    const figures = gameFigures(rulesFromScale({ exact_slot: 5, perfect_podium: 10 }));
    expect(figures.exactSlot).toBe(5);
    expect(figures.perfectPodium).toBe(25);
  });
});
