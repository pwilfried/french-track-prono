import { describe, expect, it } from "vitest";

import type { EventGender, EventSummary } from "./event";
import { filterByGender, groupEventsByDay } from "./event-list";

const event = (slug: string, startsAt: string, gender: EventGender = "M"): EventSummary => ({
  id: slug,
  slug,
  discipline: "100 m",
  gender,
  startsAt,
  lockAt: startsAt,
  isFeatured: false,
  status: "finished",
});

describe("groupEventsByDay", () => {
  it("groups events that start on the same day", () => {
    const days = groupEventsByDay(
      [event("a", "2026-09-11T17:00:00Z"), event("b", "2026-09-11T18:00:00Z")],
      "Europe/Budapest",
    );

    expect(days.map((d) => [d.day, d.events.map((e) => e.slug)])).toEqual([
      ["2026-09-11", ["a", "b"]],
    ]);
  });

  it("keeps the order of the events and of the days", () => {
    const days = groupEventsByDay(
      [event("a", "2026-09-11T17:00:00Z"), event("b", "2026-09-12T17:00:00Z")],
      "Europe/Budapest",
    );

    expect(days.map((d) => d.day)).toEqual(["2026-09-11", "2026-09-12"]);
  });

  it("uses the day of the competition time zone, not of UTC", () => {
    // 22:30 UTC is already the next day, 00:30, in Budapest (UTC+2 in September).
    const days = groupEventsByDay([event("late", "2026-09-11T22:30:00Z")], "Europe/Budapest");

    expect(days.map((d) => d.day)).toEqual(["2026-09-12"]);
  });

  it("returns no day for an empty list", () => {
    expect(groupEventsByDay([], "Europe/Budapest")).toEqual([]);
  });
});

describe("filterByGender", () => {
  const events = [
    event("w", "2026-09-11T17:00:00Z", "F"),
    event("m", "2026-09-11T17:00:00Z", "M"),
    event("x", "2026-09-11T17:00:00Z", "X"),
  ];

  it("keeps only the events of the chosen gender", () => {
    expect(filterByGender(events, "F").map((e) => e.slug)).toEqual(["w"]);
  });

  it("keeps every event when no gender is chosen", () => {
    expect(filterByGender(events, null)).toHaveLength(3);
  });
});
