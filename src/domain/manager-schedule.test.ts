import { describe, expect, it } from "vitest";

import {
  seasonCompetitions,
  seasonMatchdays,
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

const comp = (id: string, firstEventAt: string, name = id) => ({ id, name, firstEventAt });
const CLOSE = "2027-05-01T18:00:00Z";

describe("seasonCompetitions", () => {
  it("keeps the competitions whose first event starts at least 1 h after the mercato closes", () => {
    expect(
      seasonCompetitions(CLOSE, [
        comp("c1", "2027-05-01T18:59:00Z"),
        comp("c2", "2027-05-01T19:00:00Z"),
        comp("c3", "2027-06-01T18:00:00Z"),
      ]),
    ).toEqual(["c2", "c3"]);
  });

  it("leaves out a competition already started when the mercato closes", () => {
    expect(
      seasonCompetitions(CLOSE, [
        comp("c1", "2027-04-30T18:00:00Z"),
        comp("c2", "2027-06-01T18:00:00Z"),
      ]),
    ).toEqual(["c2"]);
  });

  it("orders the competitions by the date of their first event, then by name", () => {
    expect(
      seasonCompetitions(CLOSE, [
        comp("c3", "2027-07-01T18:00:00Z"),
        comp("c2", "2027-06-01T18:00:00Z", "Zurich"),
        comp("c1", "2027-06-01T18:00:00Z", "Oslo"),
      ]),
    ).toEqual(["c1", "c2", "c3"]);
  });
});

describe("seasonMatchdays", () => {
  it("gives each head-to-head matchday the next competition, first one first", () => {
    expect(seasonMatchdays(6, ["c1", "c2", "c3", "c4", "c5", "c6"])).toEqual([
      { round: 1, competition: "c1", bonus: false },
      { round: 2, competition: "c2", bonus: false },
      { round: 3, competition: "c3", bonus: false },
      { round: 4, competition: "c4", bonus: false },
      { round: 5, competition: "c5", bonus: false },
      { round: 6, competition: "c6", bonus: false },
    ]);
  });

  it("makes the competitions beyond the last head-to-head matchday bonus matchdays", () => {
    const matchdays = seasonMatchdays(6, ["c1", "c2", "c3", "c4", "c5", "c6", "c7", "c8"]);
    expect(matchdays.filter((d) => !d.bonus)).toHaveLength(6);
    expect(matchdays.slice(6)).toEqual([
      { round: 7, competition: "c7", bonus: true },
      { round: 8, competition: "c8", bonus: true },
    ]);
  });

  it("leaves the head-to-head matchdays beyond the last competition without one", () => {
    expect(seasonMatchdays(4, ["c1", "c2"])).toEqual([
      { round: 1, competition: "c1", bonus: false },
      { round: 2, competition: "c2", bonus: false },
      { round: 3, competition: null, bonus: false },
      { round: 4, competition: null, bonus: false },
    ]);
  });

  it("starts the season after a competition left out by the close of the mercato", () => {
    const competitions = seasonCompetitions(CLOSE, [
      comp("early", "2027-05-01T18:30:00Z"),
      ...["c1", "c2", "c3", "c4", "c5", "c6", "c7"].map((id, i) =>
        comp(id, `2027-06-0${i + 1}T18:00:00Z`),
      ),
    ]);
    const matchdays = seasonMatchdays(seasonRounds(4), competitions);
    expect(matchdays.map((d) => d.competition)).not.toContain("early");
    expect(matchdays[0]).toEqual({ round: 1, competition: "c1", bonus: false });
    expect(matchdays.filter((d) => d.bonus).map((d) => d.competition)).toEqual(["c7"]);
  });
});
