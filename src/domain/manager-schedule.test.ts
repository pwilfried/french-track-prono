import { describe, expect, it } from "vitest";

import {
  matchdayCompetitions,
  seasonRounds,
  seasonSchedule,
  type Fixture,
} from "./manager-schedule";

const players = (n: number) => Array.from({ length: n }, (_, i) => `p${i + 1}`);
const SIZES = [4, 6, 8, 10, 12];

/** For each player, H or A on each matchday, in order. */
function homeAway(rounds: Fixture[][], player: string): string {
  return rounds
    .map((round) => {
      const fixture = round.find((f) => f.home === player || f.away === player)!;
      return fixture.home === player ? "H" : "A";
    })
    .join("");
}

describe("seasonSchedule", () => {
  it.each(SIZES)("plays 2 × (n − 1) matchdays with %i players", (n) => {
    expect(seasonSchedule(players(n))).toHaveLength(2 * (n - 1));
    expect(seasonRounds(n)).toBe(2 * (n - 1));
  });

  it.each(SIZES)("gives each of %i players exactly one opponent on each matchday", (n) => {
    for (const round of seasonSchedule(players(n))) {
      expect(round).toHaveLength(n / 2);
      const playing = round.flatMap((f) => [f.home, f.away]);
      expect(new Set(playing)).toEqual(new Set(players(n)));
    }
  });

  it.each(SIZES)("meets each pair twice, once at home each, with %i players", (n) => {
    const fixtures = seasonSchedule(players(n)).flat();
    const keys = fixtures.map((f) => `${f.home}>${f.away}`);
    expect(new Set(keys).size).toBe(n * (n - 1));
    for (const f of fixtures) expect(f.home).not.toBe(f.away);
  });

  it.each(SIZES)("plays a full first leg, then the return leg, with %i players", (n) => {
    const rounds = seasonSchedule(players(n));
    const pairs = (legs: Fixture[][]) =>
      new Set(legs.flat().map((f) => [f.home, f.away].sort().join("-")));
    expect(pairs(rounds.slice(0, n - 1)).size).toBe((n * (n - 1)) / 2);
    expect(pairs(rounds.slice(n - 1)).size).toBe((n * (n - 1)) / 2);
  });

  it.each(SIZES)("never plays three home or three away matchdays in a row, %i players", (n) => {
    const rounds = seasonSchedule(players(n));
    for (const p of players(n)) {
      expect(homeAway(rounds, p)).not.toMatch(/HHH|AAA/);
      expect(homeAway(rounds, p).split("H")).toHaveLength(n);
    }
  });

  it.each(SIZES)("never meets the same opponent two matchdays in a row, %i players", (n) => {
    const rounds = seasonSchedule(players(n));
    for (let i = 0; i + 1 < rounds.length; i++) {
      for (const f of rounds[i]!) {
        expect(rounds[i + 1]).not.toContainEqual({ home: f.away, away: f.home });
      }
    }
  });

  it("gives the same schedule for the same players in the same order", () => {
    expect(seasonSchedule(players(8))).toEqual(seasonSchedule(players(8)));
  });

  it("schedules nothing with an odd number or fewer than two players", () => {
    expect(seasonSchedule(players(5))).toEqual([]);
    expect(seasonSchedule(players(0))).toEqual([]);
  });

  it("starts with the first player at home against the last", () => {
    expect(seasonSchedule(["a", "b", "c", "d"])[0]).toContainEqual({ home: "a", away: "d" });
  });
});

describe("matchdayCompetitions", () => {
  it("gives each matchday the next eligible competition, first one first", () => {
    expect(matchdayCompetitions(6, ["c1", "c2", "c3", "c4", "c5", "c6"])).toEqual([
      "c1",
      "c2",
      "c3",
      "c4",
      "c5",
      "c6",
    ]);
  });

  it("leaves the competitions beyond the last matchday without a head-to-head", () => {
    expect(matchdayCompetitions(2, ["c1", "c2", "c3"])).toEqual(["c1", "c2"]);
  });

  it("leaves the matchdays beyond the last competition without one", () => {
    expect(matchdayCompetitions(4, ["c1", "c2"])).toEqual(["c1", "c2", null, null]);
  });
});
