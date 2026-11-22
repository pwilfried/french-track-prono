import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  isManagerJoker,
  lineupWithJoker,
  MANAGER_JOKERS,
  managerDuelJokers,
  managerJokerHand,
  type ManagerJokerPlay,
} from "./manager-jokers";
import type { AthleteScore, ManagerCompetitionScore, ScoringLineup } from "./manager-score";

/** One line of a score: `total` split as table points + 10 of bonus when it allows it. */
const line = (athleteId: string, total: number, over: Partial<AthleteScore> = {}): AthleteScore => {
  const bonusPoints = total >= 10 ? 10 : 0;
  return {
    athleteId,
    discipline: "100 m",
    mark: "11.00",
    status: "ok",
    points: total - bonusPoints,
    bonuses: [],
    bonusPoints,
    total,
    ...over,
  };
};

const score = (...athletes: AthleteScore[]): ManagerCompetitionScore => {
  const hungarian = athletes.reduce((s, a) => s + a.points, 0);
  const bonus = athletes.reduce((s, a) => s + a.bonusPoints, 0);
  return { linedUp: true, total: hungarian + bonus, hungarian, bonus, athletes };
};

const noLineup: ManagerCompetitionScore = {
  linedUp: false,
  total: 0,
  hungarian: 0,
  bonus: 0,
  athletes: [],
};

const play = (kind: ManagerJokerPlay["kind"], over: Partial<ManagerJokerPlay> = {}) =>
  ({ kind, athleteId: null, ...over }) as ManagerJokerPlay;

/** Team of 500: A 120, B 200, C 180. Opponent of 400: X 95, Y 305. */
const mine = () => score(line("A", 120), line("B", 200), line("C", 180));
const theirs = () => score(line("X", 95), line("Y", 305));

describe("the catalogue of the Manager jokers", () => {
  it("lists the five jokers of the decision of 22 Nov. 2026, in the order they are shown", () => {
    expect(MANAGER_JOKERS).toEqual([
      "captain",
      "false_start",
      "extended_bench",
      "coaching",
      "home_advantage",
    ]);
    expect(isManagerJoker("captain")).toBe(true);
    expect(isManagerJoker("double")).toBe(false);
  });
});

describe("managerDuelJokers", () => {
  it("M22 doubles the points of the captain: tables and bonus", () => {
    const duel = managerDuelJokers(
      { score: mine(), play: play("captain", { athleteId: "A" }) },
      { score: theirs(), play: null },
    );
    expect(duel.home.total).toBe(620);
    expect(duel.home.jokers).toBe(120);
    expect(duel.home.effects).toEqual([{ kind: "captain", by: "me", athleteId: "A", points: 120 }]);
    expect(duel.away.total).toBe(400);
    expect(duel.away.effects).toEqual([]);
  });

  it("M23 gives nothing to the substitute of a captain who was replaced", () => {
    const replaced = score(
      line("S", 150, { substitution: { starterId: "A", reason: "forfeit" } }),
      line("B", 200),
    );
    const duel = managerDuelJokers(
      { score: replaced, play: play("captain", { athleteId: "A" }) },
      { score: theirs(), play: null },
    );
    expect(duel.home.total).toBe(350);
    expect(duel.home.effects).toEqual([{ kind: "captain", by: "me", athleteId: "A", points: 0 }]);
  });

  it("M24 halves the points of the opponent's athlete hit by a false start, rounded down", () => {
    const duel = managerDuelJokers(
      { score: mine(), play: play("false_start", { athleteId: "X" }) },
      { score: theirs(), play: null },
    );
    // 95 → 47: the opponent loses 48.
    expect(duel.away.total).toBe(352);
    expect(duel.away.jokers).toBe(-48);
    expect(duel.away.effects).toEqual([
      { kind: "false_start", by: "opponent", athleteId: "X", points: -48 },
    ]);
    expect(duel.home.total).toBe(500);
    expect(duel.home.effects).toEqual([
      { kind: "false_start", by: "me", athleteId: "X", points: -48 },
    ]);
  });

  it("M24 loses the false start when the athlete does not score for the opponent", () => {
    const duel = managerDuelJokers(
      { score: mine(), play: play("false_start", { athleteId: "Z" }) },
      { score: theirs(), play: null },
    );
    expect(duel.away.total).toBe(400);
    expect(duel.home.effects).toEqual([
      { kind: "false_start", by: "me", athleteId: "Z", points: 0 },
    ]);
  });

  it("M25 hits an athlete who came in as a substitute for the opponent", () => {
    const opponent = score(
      line("X", 61, { substitution: { starterId: "W", reason: "bench" } }),
      line("Y", 305),
    );
    const duel = managerDuelJokers(
      { score: mine(), play: play("false_start", { athleteId: "X" }) },
      { score: opponent, play: null },
    );
    expect(duel.away.total).toBe(366 - 31);
  });

  it("M26 halves the doubled points of the opponent's captain", () => {
    const opponent = score(line("X", 60), line("Y", 305));
    const duel = managerDuelJokers(
      { score: mine(), play: play("false_start", { athleteId: "X" }) },
      { score: opponent, play: play("captain", { athleteId: "X" }) },
    );
    // 365 + 60 (captain) = 425, then X's 120 → 60.
    expect(duel.away.total).toBe(365);
    expect(duel.away.effects).toEqual([
      { kind: "captain", by: "me", athleteId: "X", points: 60 },
      { kind: "false_start", by: "opponent", athleteId: "X", points: -60 },
    ]);
  });

  it("M29 adds 5 % of the day's total at home, rounded down, and nothing away", () => {
    const reference = score(line("A", 907));
    const home = managerDuelJokers(
      { score: reference, play: play("home_advantage") },
      { score: theirs(), play: null },
    );
    expect(home.home.total).toBe(952);
    const away = managerDuelJokers(
      { score: theirs(), play: null },
      { score: reference, play: play("home_advantage") },
    );
    expect(away.away.total).toBe(907);
    expect(away.away.effects).toEqual([
      { kind: "home_advantage", by: "me", athleteId: null, points: 0 },
    ]);
  });

  it("M30 counts the home advantage on the total after the captain and the false start", () => {
    const duel = managerDuelJokers(
      { score: mine(), play: play("home_advantage") },
      { score: theirs(), play: play("false_start", { athleteId: "B" }) },
    );
    // 500 − 100 (B 200 → 100) = 400, + 5 % = 20.
    expect(duel.home.total).toBe(420);
    expect(duel.home.jokers).toBe(-80);
  });

  it("reports the athlete brought by the extended bench or the coaching without counting it twice", () => {
    const duel = managerDuelJokers(
      { score: mine(), play: play("extended_bench", { athleteId: "C" }) },
      { score: theirs(), play: play("coaching", { athleteId: "Y", replacedId: "W" }) },
    );
    expect(duel.home.total).toBe(500);
    expect(duel.home.effects).toEqual([
      { kind: "extended_bench", by: "me", athleteId: "C", points: 180 },
    ]);
    expect(duel.away.total).toBe(400);
    expect(duel.away.effects).toEqual([
      { kind: "coaching", by: "me", athleteId: "Y", points: 305 },
    ]);
  });

  it("does nothing for a side without a lineup", () => {
    const duel = managerDuelJokers(
      { score: noLineup, play: play("home_advantage") },
      { score: theirs(), play: play("false_start", { athleteId: "X" }) },
    );
    expect(duel.home.total).toBe(0);
    expect(duel.home.jokers).toBe(0);
  });

  it("never makes a total negative nor depends on which side is home for the false start", () => {
    const lines = fc.array(fc.integer({ min: 0, max: 400 }), { minLength: 1, maxLength: 9 });
    fc.assert(
      fc.property(lines, lines, fc.nat(9), (a, b, target) => {
        const home = score(...a.map((t, i) => line(`h${i}`, t)));
        const away = score(...b.map((t, i) => line(`a${i}`, t)));
        const hit = play("false_start", { athleteId: `a${target}` });
        const one = managerDuelJokers({ score: home, play: hit }, { score: away, play: null });
        const two = managerDuelJokers({ score: away, play: null }, { score: home, play: hit });
        expect(one.away.total).toBeGreaterThanOrEqual(0);
        expect(one.away.total).toBe(two.home.total);
      }),
    );
  });
});

describe("lineupWithJoker", () => {
  const lineup = (): ScoringLineup => ({
    starters: [
      { athleteId: "A", family: "sprint", discipline: "100 m", substituteId: "S", threshold: 10.5 },
      {
        athleteId: "B",
        family: "jumps",
        discipline: "Long Jump",
        substituteId: null,
        threshold: null,
      },
    ],
    bench: [{ athleteId: "S", family: "sprint", discipline: "100 m" }],
  });

  it("M27 adds a 9th starter of any family with the extended bench", () => {
    const out = lineupWithJoker(
      lineup(),
      play("extended_bench", { athleteId: "N", family: "throws", discipline: "Shot Put" }),
    );
    expect(out.starters.at(-1)).toEqual({
      athleteId: "N",
      family: "throws",
      discipline: "Shot Put",
      substituteId: null,
      threshold: null,
    });
    expect(out.starters).toHaveLength(3);
  });

  it("takes the 9th starter off the bench when they were on it", () => {
    const out = lineupWithJoker(
      lineup(),
      play("extended_bench", { athleteId: "S", family: "sprint", discipline: "100 m" }),
    );
    expect(out.starters.map((s) => s.athleteId)).toEqual(["A", "B", "S"]);
    expect(out.bench).toEqual([]);
  });

  it("M28 puts the coached athlete in the place of the starter, in their discipline", () => {
    const out = lineupWithJoker(
      lineup(),
      play("coaching", { athleteId: "N", replacedId: "A", family: "sprint", discipline: "200 m" }),
    );
    expect(out.starters[0]).toEqual({
      athleteId: "N",
      family: "sprint",
      discipline: "200 m",
      substituteId: "S",
      threshold: null,
    });
    expect(out.starters.map((s) => s.athleteId)).toEqual(["N", "B"]);
  });

  it("leaves the lineup alone for the other jokers, an unfinished play or an athlete already lined up", () => {
    const base = lineup();
    expect(lineupWithJoker(base, play("captain", { athleteId: "A" }))).toEqual(base);
    expect(lineupWithJoker(base, play("coaching"))).toEqual(base);
    expect(
      lineupWithJoker(
        base,
        play("extended_bench", { athleteId: "B", family: "jumps", discipline: "Long Jump" }),
      ),
    ).toEqual(base);
    expect(lineupWithJoker(base, null)).toEqual(base);
  });
});

describe("managerJokerHand", () => {
  it("lists the jokers left and played, and the one of the matchday", () => {
    const hand = managerJokerHand(
      ["captain", "false_start", "home_advantage"],
      [
        { kind: "captain", competitionId: "c1" },
        { kind: "false_start", competitionId: "c2" },
      ],
      "c2",
    );
    expect(hand).toEqual({
      remaining: ["home_advantage"],
      used: [
        { kind: "captain", competitionId: "c1" },
        { kind: "false_start", competitionId: "c2" },
      ],
      onMatchday: "false_start",
    });
  });
});
