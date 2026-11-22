import { describe, expect, it } from "vitest";

import type { ConsensusPodium } from "@/domain/consensus";
import type { EventDetail, ResultLine } from "@/domain/event";

import { getCommunityTrend } from "./community-trend";
import type { ConsensusRepository } from "./consensus";
import { UseCaseError } from "./errors";
import type { EventReader } from "./list-events";

const NOW = new Date("2026-08-14T20:00:00.000Z");

const athlete = (id: string) => ({
  athleteId: id,
  slug: id,
  name: `Athlete ${id.toUpperCase()}`,
  countryCode: "FRA",
});

const event = (
  slug: string,
  lockAt: string,
  overrides: Partial<EventDetail> = {},
): EventDetail => ({
  id: slug,
  slug,
  discipline: "100 m",
  gender: "F",
  startsAt: lockAt,
  lockAt,
  isFeatured: false,
  status: "upcoming",
  round: "final",
  entries: ["a", "b", "c", "d"].map((id) => ({ ...athlete(id), seasonBest: null })),
  results: [],
  subDisciplines: [],
  previousRounds: [],
  ...overrides,
});

const result = (id: string, rank: number): ResultLine => ({ ...athlete(id), rank, mark: null });

/** A small fake of the EventReader port: one competition, its events. */
const reader = (events: EventDetail[]): EventReader => ({
  listByCompetition: async (slug) => (slug === "ultimate-2026" ? events : []),
  findBySlug: async (_competition, slug) => events.find((e) => e.slug === slug) ?? null,
});

const podium = (first: string, second: string, third: string): ConsensusPodium => ({
  podium: { first, second, third },
  mine: false,
});

/** A small fake of the ConsensusRepository port: the podiums of each locked event. */
const consensus = (podiums: Record<string, ConsensusPodium[]>): ConsensusRepository => ({
  podiums: async (eventId) => {
    const found = podiums[eventId];
    if (!found) throw new UseCaseError("EVENT_NOT_LOCKED");
    return found;
  },
});

const fourPodiums = [
  podium("a", "b", "c"),
  podium("a", "b", "c"),
  podium("a", "c", "b"),
  podium("b", "a", "c"),
];

const input = { competitionSlug: "ultimate-2026", now: NOW };

describe("getCommunityTrend", () => {
  it("shows the favourite of the last locked event and how many predicted, before the result", async () => {
    // given two locked finals, the latest predicted four times, and one still open
    const events = [
      event("100m-f", "2026-08-14T19:00:00.000Z"),
      event("200m-f", "2026-08-13T19:00:00.000Z"),
      event("400m-f", "2026-08-15T19:00:00.000Z"),
    ];
    const useCase = getCommunityTrend({
      events: reader(events),
      consensus: consensus({ "100m-f": fourPodiums, "200m-f": [podium("d", "a", "b")] }),
    });

    // when the home asks for the trend
    const trend = await useCase.execute(input);

    // then it is the latest locked event: its favourite at 1st place, its share and the count
    expect(trend).toEqual({
      slug: "100m-f",
      discipline: "100 m",
      gender: "F",
      total: 4,
      favourite: { athleteId: "a", name: "Athlete A", percent: 75 },
      result: null,
    });
  });

  it("says whether the favourite won and the share of perfect podiums, after the result", async () => {
    const official = [result("a", 1), result("b", 2), result("c", 3)];
    const useCase = getCommunityTrend({
      events: reader([
        event("100m-f", "2026-08-14T19:00:00.000Z", { status: "finished", results: official }),
      ]),
      consensus: consensus({ "100m-f": fourPodiums }),
    });

    const trend = await useCase.execute(input);

    expect(trend?.result).toEqual({ favouriteWon: true, perfectPercent: 50 });
  });

  it("says the favourite lost when another athlete won", async () => {
    const official = [result("b", 1), result("a", 2), result("c", 3)];
    const useCase = getCommunityTrend({
      events: reader([event("100m-f", "2026-08-14T19:00:00.000Z", { results: official })]),
      consensus: consensus({ "100m-f": fourPodiums }),
    });

    const trend = await useCase.execute(input);

    expect(trend?.result).toEqual({ favouriteWon: false, perfectPercent: 25 });
  });

  it("shows no trend while no event is locked", async () => {
    const useCase = getCommunityTrend({
      events: reader([event("400m-f", "2026-08-15T19:00:00.000Z")]),
      consensus: consensus({}),
    });

    expect(await useCase.execute(input)).toBeNull();
  });

  it("shows no trend when nobody predicted the last locked event", async () => {
    const useCase = getCommunityTrend({
      events: reader([event("100m-f", "2026-08-14T19:00:00.000Z")]),
      consensus: consensus({ "100m-f": [] }),
    });

    expect(await useCase.execute(input)).toBeNull();
  });

  it("leaves heats and semi-finals out, players predict finals only", async () => {
    const useCase = getCommunityTrend({
      events: reader([
        event("100m-f", "2026-08-12T19:00:00.000Z"),
        event("100m-f-semi", "2026-08-14T19:00:00.000Z", { round: "semi" }),
      ]),
      consensus: consensus({ "100m-f": fourPodiums }),
    });

    expect((await useCase.execute(input))?.slug).toBe("100m-f");
  });
});
