import { describe, expect, it } from "vitest";

import type { Discipline } from "@/domain/discipline";
import type { EventSummary } from "@/domain/event";

import type { DisciplineRepository } from "./disciplines";
import { getLeaguePredict } from "./league-predict";
import type { EventReader } from "./list-events";
import type { Prediction, PredictionRepository } from "./save-prediction";

const final = (slug: string, discipline: string, startsAt: string): EventSummary => ({
  id: slug,
  slug,
  discipline,
  gender: "F",
  startsAt,
  lockAt: startsAt,
  isFeatured: false,
  status: "upcoming",
  round: "final",
});
const discipline = (name: string, family: Discipline["family"]): Discipline => ({
  name,
  family,
  unit: "time",
  lowerIsBetter: true,
  tolerance: 0.05,
});
const posed = (userId: string, eventId: string): Prediction => ({
  userId,
  eventId,
  podium: { first: "a", second: "b", third: "c" },
});

function ports(bySlug: Record<string, EventSummary[]>, predictions: Prediction[]) {
  return {
    events: {
      listByCompetition: async (slug: string) => bySlug[slug] ?? [],
      findBySlug: async () => null,
    } satisfies EventReader,
    disciplines: {
      list: async () => [discipline("100 m", "sprint"), discipline("Javelot", "throws")],
      setTolerance: async () => "saved",
      create: async () => "created",
    } satisfies DisciplineRepository,
    predictions: {
      listForCompetition: async (userId: string, slug: string) =>
        predictions.filter(
          (p) => p.userId === userId && (bySlug[slug] ?? []).some((e) => e.id === p.eventId),
        ),
    } satisfies Pick<PredictionRepository, "listForCompetition">,
  };
}

const now = new Date("2026-09-12T10:00:00Z");

describe("getLeaguePredict (#1069)", () => {
  it("leads a sprint league to its open sprint final, not the javelin final before it", async () => {
    // given a competition with a javelin final then a 100 m final, both open
    const p = ports(
      {
        c: [
          final("javelin", "Javelot", "2026-09-12T17:00:00Z"),
          final("100m", "100 m", "2026-09-12T18:40:00Z"),
        ],
      },
      [],
    );
    // when a player of a sprint league asks for the next prediction
    const call = await getLeaguePredict(p).execute({
      userId: "me",
      competitionSlugs: ["c"],
      families: [{ family: "sprint", addedAt: null }],
      competitions: [],
      now,
    });
    // then it is the 100 m final
    expect(call).toEqual({ kind: "predict", finals: [expect.objectContaining({ slug: "100m" })] });
  });

  it("says all is posed once the player predicted the open finals of every competition", async () => {
    const p = ports(
      {
        c: [final("100m", "100 m", "2026-09-12T18:40:00Z")],
        d: [final("javelin", "Javelot", "2026-09-13T17:00:00Z")],
      },
      [posed("me", "100m"), posed("me", "javelin"), posed("other", "x")],
    );
    const call = await getLeaguePredict(p).execute({
      userId: "me",
      competitionSlugs: ["c", "d"],
      families: [],
      competitions: [],
      now,
    });
    expect(call).toEqual({
      kind: "done",
      posed: 2,
      first: expect.objectContaining({ slug: "100m", competitionSlug: "c" }),
    });
  });

  it("gives the next competition of the league, not one it does not count", async () => {
    const p = ports({ c: [] }, []);
    const call = await getLeaguePredict(p).execute({
      userId: "me",
      competitionSlugs: ["c", "later"],
      families: [],
      competitions: [
        { slug: "other", startsOn: "2026-10-01" },
        { slug: "later", startsOn: "2026-11-27" },
      ],
      now,
    });
    expect(call).toEqual({ kind: "next", competition: { slug: "later", startsOn: "2026-11-27" } });
  });
});
