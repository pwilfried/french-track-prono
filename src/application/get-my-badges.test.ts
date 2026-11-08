import { describe, expect, it } from "vitest";

import type { EventDetail, EventSummary } from "@/domain/event";

import { getMyBadges } from "./get-my-badges";
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
const reader: EventReader = {
  listByCompetition: async () => events,
  findBySlug: async (_, slug) =>
    ({
      ...events.find((e) => e.slug === slug)!,
      entries: [
        { athleteId: "fra", name: "Athlète FRA", countryCode: "FRA", seasonBest: null },
        { athleteId: "gbr", name: "Athlète GBR", countryCode: "GBR", seasonBest: null },
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
  avatar: "🦅",
  points: 3,
  reasons,
  eventId,
  eventStartsAt: events.find((e) => e.id === eventId)!.startsAt,
});
const ranking = (lines: RankingLine[]): RankingRepository => ({
  competitionLines: async () => lines,
});

describe("getMyBadges", () => {
  it("gives Bleus for a French winner found and Fidèle for a fully predicted day", async () => {
    const badges = await getMyBadges({
      ranking: ranking([line("e1", [{ kind: "exact", slot: 1 }])]),
      predictions: predictions([prediction("e1", "fra"), prediction("e2", "gbr")]),
      events: reader,
    }).execute({ userId: "me", competitionSlug: "c", timeZone: "Europe/London" });

    expect(badges).toEqual(["bleus", "fidele"]);
  });

  it("gives no Bleus when the winner found is not French", async () => {
    const badges = await getMyBadges({
      ranking: ranking([line("e2", [{ kind: "exact", slot: 1 }])]),
      predictions: predictions([prediction("e2", "gbr")]),
      events: reader,
    }).execute({ userId: "me", competitionSlug: "c", timeZone: "Europe/London" });

    expect(badges).toEqual([]);
  });
});
