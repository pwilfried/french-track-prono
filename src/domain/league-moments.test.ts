import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  feedGroups,
  leagueMoments,
  unpublished,
  type FeedMoment,
  type MomentLine,
} from "./league-moments";

const PERFECT = [{ kind: "perfect_podium" as const }];

/** Event `n` starts on day n of November 2026 at 20:00 UTC. */
const line = (userId: string, n: number, points: number, perfect = false): MomentLine => ({
  userId,
  pseudo: userId,
  points,
  reasons: perfect ? PERFECT : [],
  eventId: `e${String(n).padStart(2, "0")}`,
  eventStartsAt: `2026-11-${String(n).padStart(2, "0")}T20:00:00.000Z`,
});

const kinds = (lines: MomentLine[], kind: string) =>
  leagueMoments(lines).filter((m) => m.kind === kind);

describe("league moments: perfect podium", () => {
  it("tells each member who found the perfect podium of an event", () => {
    const moments = kinds([line("ana", 1, 25, true), line("bob", 1, 4)], "perfect_podium");
    expect(moments).toEqual([
      { key: "perfect_podium:e01:ana", kind: "perfect_podium", userId: "ana", eventId: "e01" },
    ]);
  });

  it("tells nothing when nobody found the perfect podium", () => {
    expect(kinds([line("ana", 1, 10), line("bob", 1, 4)], "perfect_podium")).toEqual([]);
  });
});

describe("league moments: new leader", () => {
  it("tells the first player alone in 1st place", () => {
    const moments = kinds([line("ana", 1, 10), line("bob", 1, 4)], "new_leader");
    expect(moments.map((m) => [m.userId, m.eventId])).toEqual([["ana", "e01"]]);
  });

  it("tells each change of 1st place, not a leader who stays", () => {
    const lines = [
      line("ana", 1, 10),
      line("bob", 1, 4),
      line("ana", 2, 2),
      line("bob", 2, 3),
      line("bob", 3, 10),
    ];
    expect(kinds(lines, "new_leader").map((m) => [m.userId, m.eventId])).toEqual([
      ["ana", "e01"],
      ["bob", "e03"],
    ]);
  });

  it("tells nobody while two players share 1st place or nobody scored", () => {
    expect(kinds([line("ana", 1, 5), line("bob", 1, 5)], "new_leader")).toEqual([]);
    expect(kinds([line("ana", 1, 0), line("bob", 1, 0)], "new_leader")).toEqual([]);
  });
});

describe("league moments: streak", () => {
  const run = (count: number) => Array.from({ length: count }, (_, i) => line("ana", i + 1, 3));

  it("tells a run of 5, 7 and 10 scoring predictions", () => {
    const lengths = kinds(run(10), "streak").map((m) => [m.length, m.eventId]);
    expect(lengths.sort((a, b) => Number(a[0]) - Number(b[0]))).toEqual([
      [5, "e05"],
      [7, "e07"],
      [10, "e10"],
    ]);
  });

  it("tells nothing under 5 and starts again after an event without points", () => {
    const lines = [...run(4), line("ana", 5, 0), line("ana", 6, 2)];
    expect(kinds(lines, "streak")).toEqual([]);
  });
});

describe("league moments: publication", () => {
  const linesArb = fc.uniqueArray(
    fc.tuple(
      fc.constantFrom("ana", "bob", "cid"),
      fc.integer({ min: 1, max: 12 }),
      fc.integer({ min: 0, max: 28 }),
      fc.boolean(),
    ),
    { selector: ([user, n]) => `${user}:${n}`, maxLength: 36 },
  );
  const toLines = (tuples: [string, number, number, boolean][]) =>
    tuples.map(([user, n, points, perfect]) => line(user, n, points, perfect && points > 0));

  it("gives the same moments whatever order the lines arrive in", () => {
    fc.assert(
      fc.property(
        linesArb.chain((tuples) =>
          fc.tuple(
            fc.constant(tuples),
            fc.shuffledSubarray(tuples, { minLength: tuples.length, maxLength: tuples.length }),
          ),
        ),
        ([tuples, shuffled]) => {
          expect(leagueMoments(toLines(shuffled))).toEqual(leagueMoments(toLines(tuples)));
        },
      ),
    );
  });

  it("publishes nothing new when the computation runs again", () => {
    fc.assert(
      fc.property(linesArb, (tuples) => {
        const lines = toLines(tuples);
        const first = leagueMoments(lines);
        expect(new Set(first.map((m) => m.key)).size).toBe(first.length);
        expect(
          unpublished(
            first.map((m) => m.key),
            leagueMoments(lines),
          ),
        ).toEqual([]);
      }),
    );
  });

  it("publishes only the moments of the new event", () => {
    const before = leagueMoments([line("ana", 1, 10)]);
    const after = leagueMoments([line("ana", 1, 10), line("bob", 2, 25, true)]);
    expect(
      unpublished(
        before.map((m) => m.key),
        after,
      ).map((m) => m.key),
    ).toEqual(["new_leader:e02:bob", "perfect_podium:e02:bob"]);
  });
});

describe("feed groups", () => {
  const moment = (key: string, happenedAt: string, competitionName?: string): FeedMoment => ({
    key,
    kind: "perfect_podium",
    happenedAt,
    pseudo: "ana",
    competitionName,
  });

  it("groups tonight by competition, then yesterday, then older days, latest first", () => {
    const groups = feedGroups(
      [
        moment("a", "2026-11-13T21:00:00.000Z", "Meeting A"),
        moment("b", "2026-11-15T21:00:00.000Z", "Meeting B"),
        moment("c", "2026-11-14T20:00:00.000Z", "Meeting B"),
        moment("d", "2026-11-15T20:00:00.000Z", "Meeting B"),
      ],
      "2026-11-15T22:00:00.000Z",
    );
    expect(groups.map((g) => [g.title, g.moments.map((m) => m.key)])).toEqual([
      [{ kind: "tonight", competitionName: "Meeting B" }, ["b", "d"]],
      [{ kind: "yesterday" }, ["c"]],
      [{ kind: "day", day: "2026-11-13" }, ["a"]],
    ]);
  });

  it("gives no group for an empty feed", () => {
    expect(feedGroups([], "2026-11-15T22:00:00.000Z")).toEqual([]);
  });
});
