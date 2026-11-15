import { describe, expect, it } from "vitest";

import type { EventDetail, EventSummary } from "@/domain/event";

import type { StoredLevels } from "@/domain/badges";

import { getMyBadges, markBadgesSeen, type BadgeLevelRepository } from "./get-my-badges";
import type { EventReader } from "./list-events";
import type { RankingLine, RankingRepository } from "./rankings";
import type { Prediction, PredictionRepository } from "./save-prediction";

const event = (id: string, startsAt: string): EventSummary => ({
  id,
  slug: id,
  discipline: "100 m",
  gender: "F",
  startsAt,
  lockAt: startsAt,
  isFeatured: false,
  status: "finished",
  round: "final",
});
const events = [event("e1", "2026-11-23T19:00:00Z"), event("e2", "2026-11-23T20:00:00Z")];
const disciplines = {
  list: async () => [
    {
      name: "100 m",
      family: "sprint" as const,
      unit: "time" as const,
      lowerIsBetter: true,
      tolerance: 0.05,
    },
  ],
};
const reader: EventReader = {
  listByCompetition: async () => events,
  findBySlug: async (_, slug) =>
    ({
      ...events.find((e) => e.slug === slug)!,
      entries: [
        {
          athleteId: "fra",
          slug: "fra",
          name: "Athlète FRA",
          countryCode: "FRA",
          seasonBest: null,
        },
        {
          athleteId: "gbr",
          slug: "gbr",
          name: "Athlète GBR",
          countryCode: "GBR",
          seasonBest: null,
        },
      ],
      results: [],
      subDisciplines: [],
      previousRounds: [],
    }) as EventDetail,
};
const prediction = (eventId: string, first: string): Prediction => ({
  userId: "me",
  eventId,
  podium: { first, second: "x", third: "y" },
  useJoker: false,
});
const predictions = (list: Prediction[]): PredictionRepository => ({
  find: async () => null,
  listForCompetition: async () => list,
  save: async () => "saved",
});
const line = (eventId: string, reasons: RankingLine["reasons"]): RankingLine => ({
  userId: "me",
  pseudo: "Me",
  bib: { number: 7, color: "blue" },
  points: 3,
  reasons,
  eventId,
  eventStartsAt: events.find((e) => e.id === eventId)!.startsAt,
});
const ranking = (lines: RankingLine[]): RankingRepository => ({
  competitionLines: async () => lines,
});

// Application tests do not import the infra layer: a few lines of fake are enough here.
function levels(start: StoredLevels = {}) {
  let stored = { ...start };
  const raised: unknown[] = [];
  const told: string[] = [];
  const repository: BadgeLevelRepository = {
    levels: async () => ({ ...stored }),
    async raise(_, list) {
      raised.push(list);
      stored = { ...stored, ...Object.fromEntries(list.map((l) => [l.badge, l.level])) };
    },
    async publishMoments(moments) {
      const fresh = moments.filter((m) => !told.includes(m.key));
      told.push(...fresh.map((m) => m.key));
      return fresh.length;
    },
  };
  return { repository, raised, told, stored: () => stored };
}

const levelOf = (progress: { badge: string; level: string | null }[], badge: string) =>
  progress.find((p) => p.badge === badge)?.level;
const earned = (progress: { badge: string; level: string | null }[]) =>
  progress.filter((p) => p.level !== null).map((p) => p.badge);

describe("getMyBadges", () => {
  it("gives Bleus for a French winner found and Fidèle for a fully predicted day", async () => {
    const { progress } = await getMyBadges({
      ranking: ranking([line("e1", [{ kind: "exact", slot: 1 }])]),
      predictions: predictions([prediction("e1", "fra"), prediction("e2", "gbr")]),
      events: reader,
      disciplines,
      levels: levels().repository,
    }).execute({ userId: "me", competitionSlugs: ["c"] });

    expect(earned(progress)).toEqual(["bleus", "fidele"]);
  });

  it("gives no Bleus when the winner found is not French", async () => {
    const { progress } = await getMyBadges({
      ranking: ranking([line("e2", [{ kind: "exact", slot: 1 }])]),
      predictions: predictions([prediction("e2", "gbr")]),
      events: reader,
      disciplines,
      levels: levels().repository,
    }).execute({ userId: "me", competitionSlugs: ["c"] });

    expect(earned(progress)).toEqual([]);
    expect(progress.find((b) => b.badge === "chasseur")).toEqual({
      badge: "chasseur",
      level: null,
      current: 1,
      target: 3,
    });
  });

  it("adds up the season's points of a family over every competition", async () => {
    // 3 points on e1 in each of the 2 competitions of the season: 6 sprint points.
    const { progress } = await getMyBadges({
      ranking: ranking([line("e1", [])]),
      predictions: predictions([]),
      events: reader,
      disciplines,
      levels: levels().repository,
    }).execute({ userId: "me", competitionSlugs: ["c1", "c2"] });

    expect(progress.find((b) => b.badge === "foudre")).toMatchObject({ current: 6, target: 50 });
  });

  it("names a new level to celebrate, and celebrates it only once it has been seen", async () => {
    const store = levels({ fidele: "bronze" });
    const ports = {
      ranking: ranking([line("e1", [{ kind: "exact", slot: 1 }])]),
      predictions: predictions([prediction("e1", "fra"), prediction("e2", "gbr")]),
      events: reader,
      disciplines,
      levels: store.repository,
    };
    const input = { userId: "me", competitionSlugs: ["c"] };

    // Given a French winner found and Fidèle already shown in bronze,
    // when the profile is read, then Bleus bronze is the one to celebrate, and nothing is stored.
    expect((await getMyBadges(ports).execute(input)).raised).toEqual([
      { badge: "bleus", level: "bronze" },
    ]);
    expect(store.raised).toEqual([]);

    // When the player has seen it, then it is stored and not celebrated again.
    await markBadgesSeen(ports).execute(input);
    expect(store.stored()).toEqual({ fidele: "bronze", bleus: "bronze" });
    expect((await getMyBadges(ports).execute(input)).raised).toEqual([]);
  });

  it("tells a level in the feeds of the player's leagues once seen, and only once", async () => {
    // Given a French winner found, nothing told yet,
    const store = levels();
    const ports = {
      ranking: ranking([line("e1", [{ kind: "exact", slot: 1 }])]),
      predictions: predictions([prediction("e1", "fra")]),
      events: reader,
      disciplines,
      levels: store.repository,
    };
    const input = { userId: "me", competitionSlugs: ["c"] };

    // when the profile is read, then nothing is told;
    await getMyBadges(ports).execute(input);
    expect(store.told).toEqual([]);

    // when the player has seen the celebration, then each new level is told, then never again.
    await markBadgesSeen(ports).execute(input);
    const told = [...store.told];
    expect(told).toContain("badge:me:bleus:bronze");
    await markBadgesSeen(ports).execute(input);
    expect(store.told).toEqual(told);
  });

  it("keeps a level won before, even when the season does not count it yet", async () => {
    const { progress, raised } = await getMyBadges({
      ranking: ranking([]),
      predictions: predictions([]),
      events: reader,
      disciplines,
      levels: levels({ chasseur: "silver" }).repository,
    }).execute({ userId: "me", competitionSlugs: ["c"] });

    expect(levelOf(progress, "chasseur")).toBe("silver");
    expect(raised).toEqual([]);
  });
});
