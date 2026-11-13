import { describe, expect, it } from "vitest";

import type { EventGender, EventSummary } from "./event";
import {
  eventsProgress,
  filterCounts,
  filterEvents,
  groupEventsByDay,
  openEvents,
} from "./event-list";

const event = (slug: string, startsAt: string, gender: EventGender = "M"): EventSummary => ({
  id: slug,
  slug,
  discipline: "100 m",
  gender,
  startsAt,
  lockAt: startsAt,
  isFeatured: false,
  status: "finished",
  round: "final",
});

describe("groupEventsByDay", () => {
  it("groups events that start on the same day", () => {
    const days = groupEventsByDay([
      event("a", "2026-09-11T17:00:00Z"),
      event("b", "2026-09-11T18:00:00Z"),
    ]);

    expect(days.map((d) => [d.day, d.events.map((e) => e.slug)])).toEqual([
      ["2026-09-11", ["a", "b"]],
    ]);
  });

  it("keeps the order of the events and of the days", () => {
    const days = groupEventsByDay([
      event("a", "2026-09-11T17:00:00Z"),
      event("b", "2026-09-12T17:00:00Z"),
    ]);

    expect(days.map((d) => d.day)).toEqual(["2026-09-11", "2026-09-12"]);
  });

  it("uses the day in Paris time, not in UTC", () => {
    // 22:30 UTC is already the next day, 00:30, in Paris (UTC+2 in September).
    const days = groupEventsByDay([event("late", "2026-09-11T22:30:00Z")]);

    expect(days.map((d) => d.day)).toEqual(["2026-09-12"]);
  });

  it("returns no day for an empty list", () => {
    expect(groupEventsByDay([])).toEqual([]);
  });
});

describe("openEvents", () => {
  const now = new Date("2026-11-23T18:00:00Z");
  const at = (iso: string, slug: string): EventSummary => ({ ...event(slug, iso), lockAt: iso });

  it("lists the events still open to predictions, soonest lock first, at most the given count", () => {
    const events = [
      at("2026-11-24T19:00:00Z", "later"),
      at("2026-11-23T17:00:00Z", "locked"),
      at("2026-11-23T19:00:00Z", "next"),
      at("2026-11-25T19:00:00Z", "last"),
    ];

    expect(openEvents(events, now, 2).map((e) => e.slug)).toEqual(["next", "later"]);
  });

  it("is empty once every event is locked", () => {
    expect(openEvents([at("2026-11-23T17:00:00Z", "locked")], now, 3)).toEqual([]);
  });
});

// The events tab (#546): Paris is UTC+2 in August.
const at = (slug: string, startsAt: string, status: EventSummary["status"] = "upcoming") => ({
  ...event(slug, startsAt),
  lockAt: new Date(Date.parse(startsAt) - 5 * 60_000).toISOString(),
  status,
});
const slugs = (events: EventSummary[]) => events.map((e) => e.slug);

describe("filterEvents and filterCounts", () => {
  const now = new Date("2026-08-15T10:00:00Z");
  const events = [
    at("todo", "2026-08-15T18:35:00Z"),
    at("posed", "2026-08-15T19:00:00Z"),
    at("done", "2026-08-14T19:00:00Z", "finished"),
    at("locked", "2026-08-15T09:00:00Z", "live"),
  ];
  const predicted = new Set(["posed", "done"]);

  it("counts what is left to do, what is posed, what has run and everything", () => {
    expect(filterCounts(events, predicted, now)).toEqual({ todo: 1, posed: 1, done: 1, all: 4 });
  });

  it("keeps the open events I have not predicted under « À faire »", () => {
    expect(slugs(filterEvents(events, predicted, now, "todo"))).toEqual(["todo"]);
  });

  it("files a finished event under « Terminées » only, even predicted", () => {
    expect(slugs(filterEvents(events, predicted, now, "posed"))).toEqual(["posed"]);
    expect(slugs(filterEvents(events, predicted, now, "done"))).toEqual(["done"]);
  });

  it("keeps every event under « Toutes »", () => {
    expect(filterEvents(events, predicted, now, "all")).toHaveLength(4);
  });
});

describe("eventsProgress", () => {
  const first = at("first", "2026-08-15T18:35:00Z");

  it("counts my podiums and adds up my points", () => {
    const progress = eventsProgress(
      [
        at("a", "2026-08-14T19:00:00Z", "finished"),
        at("b", "2026-08-14T20:00:00Z", "finished"),
        first,
      ],
      new Map([
        ["a", { points: 6 }],
        ["b", { points: null }],
      ]),
    );

    expect([progress.posed, progress.total, progress.points]).toEqual([2, 3, 6]);
  });
});
