import { describe, expect, it } from "vitest";

import { DEFAULT_RULES } from "@/domain/scoring";

import { computeEventPoints, type PointsRepository } from "./compute-event-points";
import { UseCaseError } from "./errors";
import {
  getChallenge,
  getChallengeSeason,
  getHomeChallenge,
  setFrenchTrackPick,
  type ChallengeRecord,
  type ChallengeSummary,
  type FrenchTrackRepository,
} from "./frenchtrack";

const podium = { first: "a", second: "b", third: "c" };

function repository(
  overrides: Partial<FrenchTrackRepository> & { record?: ChallengeRecord | null } = {},
) {
  const saved: { pick?: unknown; score?: number } = {};
  const frenchTrack: FrenchTrackRepository = {
    challenge: async () => overrides.record ?? null,
    challenges: async () => [],
    season: async () => [],
    savePick: async (_, pick) => {
      saved.pick = pick;
      return "saved";
    },
    removePick: async () => "removed",
    saveScore: async (_, points) => {
      saved.score = points;
      return "saved";
    },
    ...overrides,
  };
  return { frenchTrack, saved };
}

const codeOf = async (promise: Promise<unknown>) =>
  promise.then(
    () => "no error",
    (error) => (error instanceof UseCaseError ? error.code : String(error)),
  );

describe("setFrenchTrackPick", () => {
  it("posts FrenchTrack's podium of three athletes of the start list", async () => {
    // given the admin and an open event
    const { frenchTrack, saved } = repository();

    // when the admin posts FrenchTrack's podium
    await setFrenchTrackPick({ frenchTrack }).execute({
      eventId: "e1",
      startList: ["a", "b", "c", "d"],
      podium,
    });

    // then it is saved
    expect(saved.pick).toEqual(podium);
  });

  it("refuses an athlete twice or outside the start list", async () => {
    const { frenchTrack } = repository();
    const useCase = setFrenchTrackPick({ frenchTrack });

    expect(
      await codeOf(
        useCase.execute({
          eventId: "e1",
          startList: ["a", "b", "c"],
          podium: { ...podium, third: "a" },
        }),
      ),
    ).toBe("FRENCHTRACK_PICK_INVALID");
    expect(await codeOf(useCase.execute({ eventId: "e1", startList: ["a", "b"], podium }))).toBe(
      "FRENCHTRACK_PICK_INVALID",
    );
  });

  it("refuses once the event is locked, and for a player", async () => {
    const locked = repository({ savePick: async () => "locked" });
    const player = repository({ savePick: async () => "not_admin" });
    const input = { eventId: "e1", startList: ["a", "b", "c"], podium };

    expect(await codeOf(setFrenchTrackPick(locked).execute(input))).toBe("FRENCHTRACK_LOCKED");
    expect(await codeOf(setFrenchTrackPick(player).execute(input))).toBe("NOT_ADMIN");
  });
});

describe("getChallenge", () => {
  it("tells the player they beat FrenchTrack, with the share of players who did", async () => {
    // given a computed challenge where I scored 8 against FrenchTrack's 5
    const { frenchTrack } = repository({
      record: { locked: true, podium, points: 5, mine: 8, scores: [2, 5, 8, 9] },
    });

    // when I open the event
    const view = await getChallenge({ frenchTrack }).execute({ eventId: "e1" });

    // then the verdict and the share of players who beat FrenchTrack are given
    expect(view?.verdict).toBe("won");
    expect(view?.beaten).toEqual({ count: 2, percent: 50 });
  });

  it("gives no verdict before the event is computed", async () => {
    const { frenchTrack } = repository({
      record: { locked: false, podium: null, points: null, mine: null, scores: [] },
    });

    const view = await getChallenge({ frenchTrack }).execute({ eventId: "e1" });

    expect(view).toMatchObject({ podium: null, verdict: null, beaten: null });
  });

  it("is null for an event that is no challenge", async () => {
    const { frenchTrack } = repository();

    expect(await getChallenge({ frenchTrack }).execute({ eventId: "e1" })).toBeNull();
  });
});

describe("getHomeChallenge", () => {
  const summary = (eventId: string, lockAt: string, points: number | null, mine: number | null) =>
    ({
      eventId,
      slug: eventId,
      discipline: "100 m",
      gender: "F",
      startsAt: lockAt,
      lockAt,
      points,
      mine,
      scoredAt: null,
      scores: [],
    }) satisfies ChallengeSummary;

  it("shows the last challenge run with my verdict when none is open", async () => {
    const { frenchTrack } = repository({
      challenges: async () => [
        summary("old", "2026-08-01T18:00:00Z", 5, 9),
        summary("last", "2026-08-09T18:00:00Z", 5, 2),
      ],
    });

    const shown = await getHomeChallenge({ frenchTrack }).execute({
      year: 2026,
      now: new Date("2026-08-10T18:00:00Z"),
    });

    expect(shown).toMatchObject({ eventId: "last", verdict: "lost" });
  });
});

describe("getChallengeSeason", () => {
  it("ranks who beats FrenchTrack most often, with my place", async () => {
    const bib = { number: 7, color: "red" as const };
    const line = (userId: string, eventId: string, points: number) => ({
      eventId,
      userId,
      pseudo: userId,
      bib,
      points,
      frenchTrackPoints: 5,
    });
    const { frenchTrack } = repository({
      season: async () => [line("zoe", "e1", 8), line("me", "e1", 2), line("me", "e2", 9)],
    });

    const season = await getChallengeSeason({ frenchTrack }).execute({ year: 2026, userId: "me" });

    expect(season.challenges).toBe(2);
    expect(season.standings.map((s) => s.userId)).toEqual(["me", "zoe"]);
    expect(season.mine).toMatchObject({ rank: 1, wins: 1, played: 2, bib });
  });
});

describe("computeEventPoints on a challenge", () => {
  it("scores FrenchTrack's podium with the players, on the same scale", async () => {
    // given a challenge whose result is in
    const points: PointsRepository = {
      loadEvent: async () => ({
        lockAt: "2026-08-12T19:00:00Z",
        results: [
          { athleteId: "a", rank: 1 },
          { athleteId: "c", rank: 2 },
          { athleteId: "b", rank: 3 },
        ],
        predictions: [{ userId: "bob", first: "a", second: "c", third: "b" }],
        rules: DEFAULT_RULES,
      }),
      findEventScores: async () => [],
      progress: async () => ({ withResult: [], scored: [] }),
      listMine: async () => [],
      replaceEventScores: async () => "saved",
    };
    const { frenchTrack, saved } = repository({
      record: { locked: true, podium, points: null, mine: null, scores: [] },
    });

    // when the admin computes the event
    await computeEventPoints({
      points,
      frenchTrack,
      now: () => new Date("2026-08-12T21:00:00Z"),
    }).execute({ eventId: "e1" });

    // then FrenchTrack's points are stored: the winner, two athletes at the wrong place
    expect(saved.score).toBe(5);
  });
});
