import { describe, expect, it } from "vitest";

import type { EventDetail } from "@/domain/event";

import { UseCaseError } from "./errors";
import { getEvent } from "./get-event";
import type { EventReader } from "./list-events";

const athlete = (slug: string) => ({
  athleteId: slug,
  name: slug.toUpperCase(),
  countryCode: "FRA",
});

const detail = (overrides: Partial<EventDetail> = {}): EventDetail => ({
  id: "e1",
  slug: "m-100m",
  discipline: "100 m",
  gender: "M",
  startsAt: "2026-09-12T17:00:00.000Z",
  lockAt: "2026-09-12T16:55:00.000Z",
  isFeatured: true,
  status: "finished",
  entries: [],
  results: [],
  subDisciplines: [],
  ...overrides,
});

const readerWith = (event: EventDetail | null): EventReader => ({
  listByCompetition: async () => [],
  findBySlug: async () => event,
});

const input = { competitionSlug: "ultimate-2026", eventSlug: "m-100m" };

describe("getEvent", () => {
  it("returns the official podium ordered by rank", async () => {
    const reader = readerWith(
      detail({
        results: [
          { ...athlete("c"), rank: 3, mark: "9.95" },
          { ...athlete("a"), rank: 1, mark: "9.80" },
          { ...athlete("b"), rank: 2, mark: "9.90" },
        ],
      }),
    );

    const event = await getEvent({ events: reader }).execute(input);

    expect(event.results.map((r) => r.rank)).toEqual([1, 2, 3]);
  });

  it("lets tied athletes share the same rank", async () => {
    const reader = readerWith(
      detail({
        results: [
          { ...athlete("b"), rank: 3, mark: "2.28" },
          { ...athlete("a"), rank: 1, mark: "2.34" },
          { ...athlete("c"), rank: 3, mark: "2.28" },
        ],
      }),
    );

    const event = await getEvent({ events: reader }).execute(input);

    expect(event.results.map((r) => [r.athleteId, r.rank])).toEqual([
      ["a", 1],
      ["b", 3],
      ["c", 3],
    ]);
  });

  it("returns the start list with the event", async () => {
    const reader = readerWith(
      detail({
        entries: [
          { ...athlete("a"), seasonBest: "9.80" },
          { ...athlete("b"), seasonBest: null },
        ],
      }),
    );

    const event = await getEvent({ events: reader }).execute(input);

    expect(event.entries.map((e) => e.athleteId)).toEqual(["a", "b"]);
  });

  it("returns an empty podium when no result is known yet", async () => {
    const event = await getEvent({ events: readerWith(detail()) }).execute(input);

    expect(event.results).toEqual([]);
  });

  it("fails with EVENT_NOT_FOUND for an unknown event", async () => {
    const promise = getEvent({ events: readerWith(null) }).execute(input);

    await expect(promise).rejects.toEqual(new UseCaseError("EVENT_NOT_FOUND"));
  });
});
