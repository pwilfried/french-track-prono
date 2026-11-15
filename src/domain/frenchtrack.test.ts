import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  beatShare,
  challengeSeason,
  challengeMoments,
  challengeSeasonOf,
  challengeVerdict,
  featuredChallenge,
  frenchTrackScore,
  type ChallengeLine,
} from "./frenchtrack";
import { DEFAULT_RULES } from "./scoring";

const official = [
  { athleteId: "a", rank: 1 },
  { athleteId: "b", rank: 2 },
  { athleteId: "c", rank: 3 },
];

describe("frenchTrackScore", () => {
  it("scores FrenchTrack's podium with the scale of the players", () => {
    const score = frenchTrackScore(
      { first: "a", second: "c", third: "b" },
      official,
      DEFAULT_RULES,
      {
        predictionCount: 2,
        winnerPicks: { a: 2 },
      },
    );

    // 3 for the winner, 1 + 1 for two athletes on the podium at the wrong place
    expect(score.points).toBe(5);
  });

  it("never plays a joker for FrenchTrack", () => {
    const score = frenchTrackScore(
      { first: "a", second: "b", third: "c" },
      official,
      DEFAULT_RULES,
      {
        predictionCount: 1,
        winnerPicks: { a: 1 },
      },
    );

    expect(score.points).toBe(12);
    expect(score.reasons.some((r) => r.kind === "joker")).toBe(false);
  });
});

describe("challengeVerdict", () => {
  it("says the player beat FrenchTrack with more points", () => {
    expect(challengeVerdict(8, 5)).toBe("won");
  });

  it("says FrenchTrack wins with fewer points", () => {
    expect(challengeVerdict(2, 5)).toBe("lost");
  });

  it("calls a tie on the same points", () => {
    expect(challengeVerdict(5, 5)).toBe("tie");
  });

  it("says there is no prediction when the player did not predict", () => {
    expect(challengeVerdict(null, 5)).toBe("no_prediction");
  });
});

describe("beatShare", () => {
  it("counts the players who scored strictly more than FrenchTrack", () => {
    expect(beatShare([8, 5, 2, 9], 5)).toEqual({ count: 2, percent: 50 });
  });

  it("is zero without any player", () => {
    expect(beatShare([], 5)).toEqual({ count: 0, percent: 0 });
  });
});

const line = (
  userId: string,
  eventId: string,
  points: number,
  frenchTrackPoints: number,
): ChallengeLine => ({ userId, pseudo: userId.toUpperCase(), eventId, points, frenchTrackPoints });

describe("challengeSeason", () => {
  it("ranks by challenges won, then by points on the challenges played", () => {
    const standings = challengeSeason([
      line("zoe", "e1", 8, 5),
      line("zoe", "e2", 1, 6),
      line("bob", "e1", 9, 5),
      line("bob", "e2", 10, 6),
      line("ana", "e1", 6, 5),
      line("ana", "e2", 0, 6),
    ]);

    expect(standings.map((s) => [s.userId, s.rank, s.wins, s.played, s.points])).toEqual([
      ["bob", 1, 2, 2, 19],
      ["zoe", 2, 1, 2, 9],
      ["ana", 3, 1, 2, 6],
    ]);
  });

  it("counts a tie as played, not won", () => {
    const [standing] = challengeSeason([line("zoe", "e1", 5, 5)]);

    expect(standing).toMatchObject({ wins: 0, ties: 1, played: 1 });
  });

  it("shares the place of players still equal, listed by pseudo", () => {
    const standings = challengeSeason([line("zoe", "e1", 7, 5), line("ana", "e1", 7, 5)]);

    expect(standings.map((s) => [s.userId, s.rank])).toEqual([
      ["ana", 1],
      ["zoe", 1],
    ]);
  });

  it("never depends on the order the predictions arrive in", () => {
    const lines = fc.array(
      fc.record({
        userId: fc.constantFrom("ana", "bob", "cleo", "dan"),
        eventId: fc.constantFrom("e1", "e2", "e3"),
        points: fc.integer({ min: 0, max: 28 }),
      }),
    );
    const frenchTrack: Record<string, number> = { e1: 5, e2: 0, e3: 12 };
    fc.assert(
      fc.property(lines, fc.integer(), (rows, seed) => {
        // One line per player and challenge, as stored.
        const unique = [...new Map(rows.map((r) => [`${r.userId}/${r.eventId}`, r])).values()].map(
          (r) => line(r.userId, r.eventId, r.points, frenchTrack[r.eventId]!),
        );
        const shuffled = [...unique];
        let state = seed;
        for (let i = shuffled.length - 1; i > 0; i -= 1) {
          state = (state * 1103515245 + 12345) % 2147483648;
          const j = Math.abs(state) % (i + 1);
          [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
        }
        expect(challengeSeason(shuffled)).toEqual(challengeSeason(unique));
      }),
    );
  });
});

describe("featuredChallenge", () => {
  const now = new Date("2026-08-10T18:00:00Z");
  const challenge = (eventId: string, lockAt: string, startsAt = lockAt) => ({
    eventId,
    lockAt,
    startsAt,
  });

  it("shows the open challenge that locks first", () => {
    const shown = featuredChallenge(
      [
        challenge("later", "2026-08-12T18:00:00Z"),
        challenge("soon", "2026-08-11T18:00:00Z"),
        challenge("past", "2026-08-09T18:00:00Z"),
      ],
      now,
    );

    expect(shown?.eventId).toBe("soon");
  });

  it("shows the last challenge run when none is open", () => {
    const shown = featuredChallenge(
      [challenge("old", "2026-08-01T18:00:00Z"), challenge("last", "2026-08-09T18:00:00Z")],
      now,
    );

    expect(shown?.eventId).toBe("last");
  });

  it("shows nothing without any challenge", () => {
    expect(featuredChallenge([], now)).toBeNull();
  });
});

describe("challengeMoments", () => {
  const challenge = (
    eventId: string,
    scoredAt: string | null,
    points: number | null,
    mine: number | null,
    scores: number[],
  ) => ({
    eventId,
    slug: `slug-${eventId}`,
    discipline: "100 m",
    gender: "F" as const,
    scoredAt,
    points,
    mine,
    scores,
  });

  it("tells each computed challenge, latest computed first, with the share and my verdict", () => {
    const moments = challengeMoments(
      [
        challenge("old", "2026-08-01T21:00:00.000Z", 5, 9, [2, 5, 9, 12]),
        challenge("last", "2026-08-09T21:00:00.000Z", 5, null, [2, 9]),
      ],
      10,
    );

    expect(moments).toEqual([
      {
        key: "frenchtrack:last",
        eventId: "last",
        slug: "slug-last",
        discipline: "100 m",
        gender: "F",
        happenedAt: "2026-08-09T21:00:00.000Z",
        beaten: { count: 1, percent: 50 },
        verdict: "no_prediction",
      },
      expect.objectContaining({
        key: "frenchtrack:old",
        beaten: { count: 2, percent: 50 },
        verdict: "won",
      }),
    ]);
  });

  it("tells nothing of a challenge whose points are not computed yet", () => {
    expect(challengeMoments([challenge("open", null, null, null, [])], 10)).toEqual([]);
  });

  it("keeps the latest ones only", () => {
    const moments = challengeMoments(
      [
        challenge("a", "2026-08-01T21:00:00.000Z", 5, 5, [5]),
        challenge("b", "2026-08-03T21:00:00.000Z", 5, 5, [5]),
        challenge("c", "2026-08-02T21:00:00.000Z", 5, 5, [5]),
      ],
      2,
    );

    expect(moments.map((m) => m.eventId)).toEqual(["b", "c"]);
  });
});

describe("challengeSeasonOf", () => {
  it("is the calendar year in Paris, so New Year's Eve night already counts for the new one", () => {
    expect(challengeSeasonOf("2026-12-31T23:30:00.000Z")).toBe(2027);
    expect(challengeSeasonOf("2026-06-01T12:00:00.000Z")).toBe(2026);
  });
});
