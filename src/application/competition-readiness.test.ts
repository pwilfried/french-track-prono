import { describe, expect, it } from "vitest";

import type { EventSummary } from "@/domain/event";

import { getCompetitionReadiness } from "./competition-readiness";

const event = (id: string, round: EventSummary["round"], lockAt: string): EventSummary => ({
  id,
  slug: id,
  discipline: "100 m",
  gender: "F",
  startsAt: lockAt,
  lockAt,
  isFeatured: false,
  status: "upcoming",
  round,
});

describe("competition readiness on the dashboard", () => {
  it("counts the finals with a start list and odds, and those still open without odds", async () => {
    // given three finals and a series, one final already locked
    const events = {
      listByCompetition: async () => [
        event("f1", "final", "2026-11-20T10:00:00Z"),
        event("f2", "final", "2026-11-21T10:00:00Z"),
        event("f3", "final", "2026-11-01T10:00:00Z"),
        event("h1", "series", "2026-11-19T10:00:00Z"),
      ],
      findBySlug: async () => null,
    };
    const readiness = {
      readiness: async () => ({ withStartList: ["f1", "f2", "h1"], withOdds: ["f1", "h1"] }),
    };
    // when the dashboard reads it
    const ready = await getCompetitionReadiness({ events, readiness }).execute({
      competitionSlug: "uc-2026",
      now: new Date("2026-11-09T12:00:00Z"),
    });
    // then series are left out and the locked final needs no more odds
    expect(ready).toEqual({ finals: 3, withStartList: 2, withOdds: 1, openWithoutOdds: 1 });
  });
});
