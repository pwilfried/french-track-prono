import { describe, expect, it } from "vitest";

import type { EventDetail, EventSummary } from "@/domain/event";

import type { EventReader } from "./list-events";
import {
  countPredictions,
  getMyPredictionHistory,
  listMyEventMarks,
  listMyPredictions,
} from "./list-my-predictions";
import type { Prediction, PredictionRepository } from "./save-prediction";

const prediction = (userId: string, eventId: string, useJoker = false): Prediction => ({
  userId,
  eventId,
  podium: { first: "a", second: "b", third: "c" },
  useJoker,
});

function repositoryWith(all: Prediction[]): PredictionRepository {
  return {
    find: async () => null,
    save: async () => "saved",
    listForCompetition: async (userId) => all.filter((p) => p.userId === userId),
  };
}

describe("listMyPredictions", () => {
  it("returns the predictions of the player with the joker flag", async () => {
    const mine = [prediction("me", "e1", true), prediction("me", "e2")];
    const useCase = listMyPredictions({ predictions: repositoryWith(mine) });

    expect(await useCase.execute({ userId: "me", competitionSlug: "c" })).toEqual(mine);
  });

  it("does not return the predictions of other players", async () => {
    const useCase = listMyPredictions({
      predictions: repositoryWith([prediction("me", "e1"), prediction("other", "e1")]),
    });

    const result = await useCase.execute({ userId: "me", competitionSlug: "c" });

    expect(result.map((p) => p.userId)).toEqual(["me"]);
  });
});

describe("listMyEventMarks", () => {
  it("gives each of my predicted events its joker and its points once they are computed", async () => {
    // Given two predictions of mine, the points computed for the first event only
    const useCase = listMyEventMarks({
      predictions: repositoryWith([prediction("me", "e1", true), prediction("me", "e2")]),
      points: {
        listMine: async () => [{ userId: "me", eventId: "e1", points: 12, reasons: [] }],
      },
    });

    // When the events list asks for my marks
    const marks = await useCase.execute({ userId: "me", competitionSlug: "c" });

    // Then the first event shows its points, the second none yet
    expect(marks).toEqual([
      { eventId: "e1", joker: true, points: 12, hits: { exact: 0, onPodium: 0, perfect: false } },
      { eventId: "e2", joker: false, points: null, hits: null },
    ]);
  });

  it("sums up what my podium got right, for the card of a finished event (#546)", async () => {
    // Given points computed for a perfect podium
    const useCase = listMyEventMarks({
      predictions: repositoryWith([prediction("me", "e1")]),
      points: {
        listMine: async () => [
          {
            userId: "me",
            eventId: "e1",
            points: 12,
            reasons: [
              { kind: "exact", slot: 1 },
              { kind: "exact", slot: 2 },
              { kind: "exact", slot: 3 },
              { kind: "perfect_podium" },
            ],
          },
        ],
      },
    });

    // When the events list asks for my marks
    const [mark] = await useCase.execute({ userId: "me", competitionSlug: "c" });

    // Then the card knows the three athletes are well placed and the podium perfect
    expect(mark?.hits).toEqual({ exact: 3, onPodium: 0, perfect: true });
  });
});

describe("countPredictions", () => {
  function perCompetition(byCompetition: Record<string, Prediction[]>): PredictionRepository {
    return {
      find: async () => null,
      save: async () => "saved",
      listForCompetition: async (userId, slug) =>
        (byCompetition[slug] ?? []).filter((p) => p.userId === userId),
    };
  }

  it("is zero for a player without any prediction", async () => {
    const useCase = countPredictions({
      predictions: perCompetition({ c1: [prediction("other", "e1")] }),
    });

    expect(await useCase.execute({ userId: "me", competitionSlugs: ["c1", "c2"] })).toBe(0);
  });

  it("counts the podiums of the player across the competitions", async () => {
    const useCase = countPredictions({
      predictions: perCompetition({
        c1: [prediction("me", "e1")],
        c2: [prediction("me", "e9"), prediction("other", "e9")],
      }),
    });

    expect(await useCase.execute({ userId: "me", competitionSlugs: ["c1", "c2"] })).toBe(2);
  });
});

describe("getMyPredictionHistory", () => {
  const event = (id: string, startsAt: string): EventSummary => ({
    id,
    slug: `${id}-slug`,
    discipline: "100 m",
    gender: "F",
    startsAt,
    lockAt: startsAt,
    isFeatured: false,
    status: "finished",
    round: "final",
  });
  const athlete = (athleteId: string) => ({
    athleteId,
    slug: athleteId,
    name: `Athlète ${athleteId.toUpperCase()}`,
    countryCode: "FRA",
  });
  // Competition c1: e1 (with a result), e2; competition c2: e3, the latest.
  const byCompetition: Record<string, EventSummary[]> = {
    c1: [event("e1", "2026-11-20T19:00:00Z"), event("e2", "2026-11-21T19:00:00Z")],
    c2: [event("e3", "2026-11-25T19:00:00Z")],
  };
  const reads: string[] = [];
  const events: EventReader = {
    listByCompetition: async (slug) => byCompetition[slug] ?? [],
    findBySlug: async (slug, eventSlug) => {
      reads.push(eventSlug);
      const summary = byCompetition[slug!]!.find((e) => e.slug === eventSlug)!;
      return {
        ...summary,
        entries: ["a", "b", "c"].map((id) => ({ ...athlete(id), seasonBest: null })),
        results:
          summary.id === "e1"
            ? [
                { ...athlete("a"), rank: 1, mark: null },
                { ...athlete("c"), rank: 2, mark: null },
                { ...athlete("z"), rank: 3, mark: null },
              ]
            : [],
        subDisciplines: [],
        previousRounds: [],
      } satisfies EventDetail;
    },
  };
  const ports = {
    predictions: {
      ...repositoryWith([]),
      listForCompetition: async (_: string, slug: string) =>
        (byCompetition[slug] ?? []).map((e) => prediction("me", e.id, e.id === "e1")),
    },
    events,
    points: {
      listMine: async (_: string, slug: string) =>
        slug === "c1" ? [{ eventId: "e1", userId: "me", points: 6, reasons: [] }] : [],
    },
  };

  it("lists the latest event first, with the outcome of each pick and the points", async () => {
    const lines = await getMyPredictionHistory(ports).execute({
      userId: "me",
      competitionSlugs: ["c1", "c2"],
    });

    expect(lines.map((l) => [l.eventSlug, l.points])).toEqual([
      ["e3-slug", null],
      ["e2-slug", null],
      ["e1-slug", 6],
    ]);
    expect(lines[2]).toMatchObject({
      competitionSlug: "c1",
      joker: true,
      picks: [
        { name: "Athlète A", hit: "exact" },
        { name: "Athlète B", hit: "missed" },
        { name: "Athlète C", hit: "misplaced" },
      ],
    });
    expect(lines[0]!.picks.every((p) => p.hit === "pending")).toBe(true);
  });

  it("reads the athletes of the lines kept only", async () => {
    reads.length = 0;
    const lines = await getMyPredictionHistory(ports).execute({
      userId: "me",
      competitionSlugs: ["c1", "c2"],
      limit: 1,
    });

    expect(lines.map((l) => l.eventSlug)).toEqual(["e3-slug"]);
    expect(reads).toEqual(["e3-slug"]);
  });
});
