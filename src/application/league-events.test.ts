import { describe, expect, it } from "vitest";

import type { Discipline } from "@/domain/discipline";
import type { EventSummary } from "@/domain/event";

import type { DisciplineRepository } from "./disciplines";
import { listLeagueEvents } from "./league-events";
import type { EventReader } from "./list-events";

const event = (
  slug: string,
  discipline: string,
  startsAt: string,
  round = "final",
): EventSummary => ({
  id: slug,
  slug,
  discipline,
  gender: "M",
  startsAt,
  lockAt: startsAt,
  isFeatured: false,
  status: "upcoming",
  round: round as EventSummary["round"],
});
const discipline = (name: string, family: Discipline["family"]): Discipline => ({
  name,
  family,
  unit: "time",
  lowerIsBetter: true,
  tolerance: 0.05,
});
const ports = (bySlug: Record<string, EventSummary[]>) => ({
  events: {
    listByCompetition: async (slug: string) => bySlug[slug] ?? [],
    findBySlug: async () => null,
  } satisfies EventReader,
  disciplines: {
    list: async () => [
      discipline("100 m", "sprint"),
      discipline("Javelot", "throws"),
      discipline("Saut en hauteur", "vertical_jumps"),
    ],
    setTolerance: async () => "saved",
    create: async () => "created",
  } satisfies DisciplineRepository,
});

describe("listLeagueEvents (#613)", () => {
  it("marks the javelin out of a sprint league, both finals listed in time order", async () => {
    // given a competition with a 100 m final, a javelin final and a 100 m heat
    const p = ports({
      c: [
        event("javelin", "Javelot", "2026-09-12T19:00:00Z"),
        event("100m", "100 m", "2026-09-12T18:00:00Z"),
        event("100m-heat", "100 m", "2026-09-11T18:00:00Z", "heat"),
      ],
    });
    // when the events of a sprint league are listed
    const events = await listLeagueEvents(p).execute({
      competitionSlugs: ["c"],
      families: [{ family: "sprint", addedAt: null }],
    });
    // then the finals are listed, only the 100 m counts
    expect(events.map((e) => [e.slug, e.family, e.counts])).toEqual([
      ["100m", "sprint", true],
      ["javelin", "throws", false],
    ]);
  });

  it("counts every event in a league on all events", async () => {
    const p = ports({ c: [event("javelin", "Javelot", "2026-09-12T19:00:00Z")] });
    const events = await listLeagueEvents(p).execute({ competitionSlugs: ["c"], families: [] });
    expect(events.map((e) => [e.slug, e.counts])).toEqual([["javelin", true]]);
  });

  it("previews a family to add: only its events not started yet would count", async () => {
    const p = ports({
      c: [
        event("javelin", "Javelot", "2026-09-12T10:00:00Z"),
        event("high-jump", "Saut en hauteur", "2026-09-13T10:00:00Z"),
      ],
      d: [event("javelin-2", "Javelot", "2026-09-14T10:00:00Z")],
    });
    const events = await listLeagueEvents(p).execute({
      competitionSlugs: ["c", "d"],
      families: [{ family: "sprint", addedAt: null }],
      adding: { family: "throws", now: "2026-09-12T12:00:00Z" },
    });
    expect(events.map((e) => [e.slug, e.competitionSlug, e.counts])).toEqual([
      ["javelin", "c", false],
      ["javelin-2", "d", true],
    ]);
  });
});
