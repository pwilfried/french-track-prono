import { describe, expect, it } from "vitest";

import type { EventSummary } from "@/domain/event";

import { listEvents, type EventReader } from "./list-events";

const event = (
  slug: string,
  startsAt: string,
  isFeatured = false,
  round: EventSummary["round"] = "final",
): EventSummary => ({
  id: slug,
  slug,
  discipline: "100 m",
  gender: "M",
  startsAt,
  lockAt: startsAt,
  isFeatured,
  status: "finished",
  round,
});

const readerWith = (bySlug: Record<string, EventSummary[]>): EventReader => ({
  listByCompetition: async (slug) => bySlug[slug] ?? [],
  findBySlug: async () => null,
});

describe("listEvents", () => {
  it("returns the events of a competition ordered by start time", async () => {
    const reader = readerWith({
      "ultimate-2026": [event("b", "2026-09-12T17:00:00Z"), event("a", "2026-09-11T17:00:00Z")],
    });

    const events = await listEvents({ events: reader }).execute({
      competitionSlug: "ultimate-2026",
    });

    expect(events.map((e) => e.slug)).toEqual(["a", "b"]);
  });

  it("keeps the featured flag of each event", async () => {
    const reader = readerWith({
      "ultimate-2026": [
        event("a", "2026-09-11T17:00:00Z", true),
        event("b", "2026-09-12T17:00:00Z"),
      ],
    });

    const events = await listEvents({ events: reader }).execute({
      competitionSlug: "ultimate-2026",
    });

    expect(events.map((e) => e.isFeatured)).toEqual([true, false]);
  });

  it("returns an empty list for an unknown competition", async () => {
    const events = await listEvents({ events: readerWith({}) }).execute({
      competitionSlug: "nope",
    });

    expect(events).toEqual([]);
  });

  it("does not modify the list given by the reader", async () => {
    const stored = [event("b", "2026-09-12T17:00:00Z"), event("a", "2026-09-11T17:00:00Z")];

    await listEvents({ events: readerWith({ c: stored }) }).execute({ competitionSlug: "c" });

    expect(stored.map((e) => e.slug)).toEqual(["b", "a"]);
  });

  it("shows players the finals only, and the back-office every round", async () => {
    const reader = readerWith({
      "ultimate-2026": [
        event("semi-1", "2026-09-11T17:00:00Z", false, "semi"),
        event("final", "2026-09-12T17:00:00Z"),
      ],
    });
    const useCase = listEvents({ events: reader });

    const finals = await useCase.execute({ competitionSlug: "ultimate-2026" });
    const all = await useCase.execute({ competitionSlug: "ultimate-2026", withRounds: true });

    expect(finals.map((e) => e.slug)).toEqual(["final"]);
    expect(all.map((e) => e.slug)).toEqual(["semi-1", "final"]);
  });
});
