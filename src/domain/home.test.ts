import { describe, expect, it } from "vitest";

import type { EventSummary } from "./event";
import { openFinals } from "./home";

const event = (
  id: string,
  lockAt: string,
  round: EventSummary["round"] = "final",
): EventSummary => ({
  id,
  slug: id,
  discipline: "100 m",
  gender: "F",
  startsAt: lockAt,
  lockAt,
  isFeatured: false,
  status: "upcoming",
  round,
});

describe("openFinals", () => {
  const now = new Date("2026-11-23T12:00:00Z");

  it("keeps the finals still open, in start order, marked predicted or not", () => {
    const finals = openFinals(
      [
        event("late", "2026-11-25T19:00:00Z"),
        event("locked", "2026-11-23T11:00:00Z"),
        event("heat", "2026-11-23T18:00:00Z", "series"),
        event("soon", "2026-11-23T20:40:00Z"),
      ],
      new Set(["late"]),
      now,
    );
    expect(finals.map((f) => [f.id, f.predicted])).toEqual([
      ["soon", false],
      ["late", true],
    ]);
  });

  it("is empty once every final is locked", () => {
    expect(openFinals([event("a", "2026-11-23T12:00:00Z")], new Set(), now)).toEqual([]);
  });
});
