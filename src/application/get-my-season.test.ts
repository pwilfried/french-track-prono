import { describe, expect, it } from "vitest";

import type { EventSummary } from "@/domain/event";

import { getMySeason } from "./get-my-season";
import type { RankingLine } from "./rankings";

const event = (id: string, discipline: string, day: number): EventSummary => ({
  id,
  slug: id,
  discipline,
  gender: "F",
  startsAt: new Date(Date.UTC(2026, 7, day)).toISOString(),
  lockAt: new Date(Date.UTC(2026, 7, day)).toISOString(),
  isFeatured: false,
  status: "finished",
  round: "final",
});

const line = (userId: string, eventId: string, day: number, points: number): RankingLine => ({
  userId,
  pseudo: userId,
  avatar: "🦌",
  points,
  reasons: points >= 12 ? [{ kind: "perfect_podium" }] : [],
  eventId,
  eventStartsAt: new Date(Date.UTC(2026, 7, day)).toISOString(),
});

describe("my season on the profile", () => {
  it("adds up every competition: rank, players, points and the figures", async () => {
    // given two competitions, a rival ahead and my predictions on both
    const lines: Record<string, RankingLine[]> = {
      uc: [line("me", "e1", 1, 12), line("rival", "e1", 1, 20)],
      fr: [line("me", "e2", 5, 3), line("rival", "e2", 5, 0)],
    };
    const events: Record<string, EventSummary[]> = {
      uc: [event("e1", "100 m", 1)],
      fr: [event("e2", "Lancer du poids", 5)],
    };
    const season = await getMySeason({
      ranking: { competitionLines: async (slug) => lines[slug] ?? [] },
      predictions: {
        find: async () => null,
        listForCompetition: async (_user, slug) =>
          (events[slug] ?? []).map((e) => ({
            userId: "me",
            eventId: e.id,
            podium: { first: "a", second: "b", third: "c" },
            useJoker: false,
          })),
        save: async () => "saved",
      },
      events: {
        listByCompetition: async (slug) => events[slug] ?? [],
        findBySlug: async () => null,
      },
      disciplines: {
        list: async () => [
          { name: "100 m", family: "sprint", unit: "time", lowerIsBetter: true, tolerance: 0.05 },
          {
            name: "Lancer du poids",
            family: "throws",
            unit: "distance",
            lowerIsBetter: false,
            tolerance: 0.2,
          },
        ],
        setTolerance: async () => "saved",
        create: async () => "created",
      },
    }).execute({ userId: "me", competitionSlugs: ["uc", "fr"] });
    // then I am second of two with 15 points, my best shot is the perfect podium of the 100 m
    expect(season).toMatchObject({ rank: 2, players: 2, points: 15 });
    expect(season.stats).toMatchObject({ predictions: 2, perfectPodiums: 1, curve: [12, 15] });
    expect(season.stats.bestShot).toMatchObject({
      eventId: "e1",
      discipline: "100 m",
      perfect: true,
    });
    expect(season.stats.families.map((f) => f.family).sort()).toEqual(["sprint", "throws"]);
  });

  it("has no rank before the first point", async () => {
    const season = await getMySeason({
      ranking: { competitionLines: async () => [] },
      predictions: {
        find: async () => null,
        listForCompetition: async () => [],
        save: async () => "saved",
      },
      events: { listByCompetition: async () => [], findBySlug: async () => null },
      disciplines: {
        list: async () => [],
        setTolerance: async () => "saved",
        create: async () => "created",
      },
    }).execute({ userId: "me", competitionSlugs: ["uc"] });
    expect(season).toMatchObject({ rank: null, players: 0, points: 0 });
  });
});
