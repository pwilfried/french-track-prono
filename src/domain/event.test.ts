import { describe, expect, it } from "vitest";

import { compareEvents, type EventSummary } from "./event";

const event = (slug: string, startsAt: string): EventSummary => ({
  id: slug,
  slug,
  discipline: "100 m",
  gender: "M",
  startsAt,
  lockAt: startsAt,
  isFeatured: false,
  status: "finished",
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
