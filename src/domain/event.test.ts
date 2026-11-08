import { describe, expect, it } from "vitest";

import { compareEvents, compareResults, type EventSummary, type ResultLine } from "./event";

const event = (slug: string, startsAt: string): EventSummary => ({
  id: slug,
  slug,
  discipline: "100 m",
  gender: "M",
  startsAt,
  lockAt: startsAt,
  isFeatured: false,
  status: "finished",
  round: "final",
});

describe("compareEvents", () => {
  it("orders events by start time", () => {
    const events = [event("late", "2026-09-13T17:00:00Z"), event("early", "2026-09-11T17:00:00Z")];

    expect(events.sort(compareEvents).map((e) => e.slug)).toEqual(["early", "late"]);
  });

  it("breaks ties on the slug so the order is stable", () => {
    const events = [
      event("m-100m", "2026-09-12T17:00:00Z"),
      event("f-100m", "2026-09-12T17:00:00Z"),
    ];

    expect(events.sort(compareEvents).map((e) => e.slug)).toEqual(["f-100m", "m-100m"]);
  });
});

const line = (name: string, rank: number): ResultLine => ({
  athleteId: name,
  slug: name,
  name,
  countryCode: "FRA",
  rank,
  mark: null,
});

describe("compareResults", () => {
  it("orders result lines by rank", () => {
    const lines = [line("c", 3), line("a", 1), line("b", 2)];

    expect(lines.sort(compareResults).map((l) => l.rank)).toEqual([1, 2, 3]);
  });

  it("orders tied athletes by name so the order is stable", () => {
    const lines = [line("zed", 3), line("amy", 3)];

    expect(lines.sort(compareResults).map((l) => l.name)).toEqual(["amy", "zed"]);
  });
});
