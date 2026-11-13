import { describe, expect, it } from "vitest";

import type { EventStatus, EventSummary } from "./event";
import { defaultDay, eventsBySession, eventsOfDay, programDays, sessionOf } from "./program";

const event = (slug: string, startsAt: string, status: EventStatus = "upcoming"): EventSummary => ({
  id: slug,
  slug,
  discipline: "100 m",
  gender: "F",
  startsAt,
  lockAt: startsAt,
  isFeatured: false,
  status,
  round: "final",
});

describe("sessionOf", () => {
  it("puts a start before noon, Paris time, in the morning", () => {
    // 09:30 UTC in June is 11:30 in Paris.
    expect(sessionOf("2027-06-25T09:30:00Z")).toBe("morning");
  });

  it("puts a start from noon to 6 pm in the afternoon", () => {
    expect(sessionOf("2027-06-25T10:00:00Z")).toBe("afternoon");
    expect(sessionOf("2027-06-25T15:59:00Z")).toBe("afternoon");
  });

  it("puts a start from 6 pm, and the night after, in the evening", () => {
    expect(sessionOf("2027-06-25T16:00:00Z")).toBe("evening");
    // 01:00 in Paris: an overseas session that ends after midnight.
    expect(sessionOf("2027-06-25T23:00:00Z")).toBe("evening");
  });

  it("reads the hour in Paris time in winter too", () => {
    // 11:30 UTC in February is 12:30 in Paris.
    expect(sessionOf("2027-02-20T11:30:00Z")).toBe("afternoon");
  });
});

describe("programDays", () => {
  it("lists every day of the competition, with its events and their state", () => {
    const days = programDays(
      { startsOn: "2027-06-25", endsOn: "2027-06-27" },
      [
        event("a", "2027-06-25T17:00:00Z", "finished"),
        event("b", "2027-06-26T17:00:00Z", "finished"),
        event("c", "2027-06-26T18:00:00Z"),
      ],
      "2027-06-26",
    );

    expect(days).toEqual([
      { day: "2027-06-25", events: 1, today: false, done: true },
      { day: "2027-06-26", events: 2, today: true, done: false },
      { day: "2027-06-27", events: 0, today: false, done: false },
    ]);
  });

  it("keeps an event after midnight on the evening before", () => {
    const days = programDays(
      { startsOn: "2027-06-25", endsOn: "2027-06-25" },
      [event("late", "2027-06-25T23:30:00Z")],
      "2027-06-20",
    );

    expect(days.map((d) => [d.day, d.events])).toEqual([["2027-06-25", 1]]);
  });

  it("adds a day an event falls on outside the dates of the competition", () => {
    const days = programDays(
      { startsOn: "2027-06-25", endsOn: "2027-06-25" },
      [event("a", "2027-06-24T17:00:00Z")],
      "2027-06-20",
    );

    expect(days.map((d) => d.day)).toEqual(["2027-06-24", "2027-06-25"]);
  });
});

describe("defaultDay", () => {
  const days = programDays({ startsOn: "2027-06-25", endsOn: "2027-06-27" }, [], "2027-06-26");

  it("opens today during the competition", () => {
    expect(defaultDay(days, "2027-06-26", undefined)).toBe("2027-06-26");
  });

  it("opens the first day before or after the competition", () => {
    expect(defaultDay(days, "2027-06-01", undefined)).toBe("2027-06-25");
    expect(defaultDay(days, "2027-07-01", undefined)).toBe("2027-06-25");
  });

  it("opens the day asked for when it belongs to the competition", () => {
    expect(defaultDay(days, "2027-06-26", "2027-06-27")).toBe("2027-06-27");
    expect(defaultDay(days, "2027-06-26", "2030-01-01")).toBe("2027-06-26");
  });

  it("has no day without dates", () => {
    expect(defaultDay([], "2027-06-26", undefined)).toBeNull();
  });
});

describe("eventsOfDay and eventsBySession", () => {
  const events = [
    event("evening", "2027-06-25T18:00:00Z"),
    event("morning", "2027-06-25T08:00:00Z"),
    event("afternoon", "2027-06-25T12:00:00Z"),
    event("next-day", "2027-06-26T08:00:00Z"),
    event("evening-2", "2027-06-25T17:00:00Z"),
  ];

  it("keeps only the events of the day", () => {
    expect(eventsOfDay(events, "2027-06-26").map((e) => e.slug)).toEqual(["next-day"]);
  });

  it("groups the events of a day by session, morning first, in start order", () => {
    const sessions = eventsBySession(eventsOfDay(events, "2027-06-25"));

    expect(sessions.map((s) => [s.session, s.events.map((e) => e.slug)])).toEqual([
      ["morning", ["morning"]],
      ["afternoon", ["afternoon"]],
      ["evening", ["evening-2", "evening"]],
    ]);
  });

  it("leaves out a session without events", () => {
    expect(eventsBySession([event("a", "2027-06-25T18:00:00Z")]).map((s) => s.session)).toEqual([
      "evening",
    ]);
  });
});
