import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { unpublished } from "./league-moments";
import {
  badgeMoments,
  duelMoments,
  managerMoments,
  mercatoMoments,
  type DuelFact,
  type MercatoWinFact,
} from "./manager-moments";

const win = (round: number, athleteId: string, userId = "ana", price = 30): MercatoWinFact => ({
  round,
  athleteId,
  athlete: `Athlète ${athleteId}`,
  price,
  userId,
  pseudo: userId,
  closedAt: `2026-11-0${round}T10:00:00.000Z`,
});

const duel = (round: number, home: [string, number], away: [string, number]): DuelFact => ({
  round,
  home: { userId: home[0], pseudo: home[0], score: home[1] },
  away: { userId: away[0], pseudo: away[0], score: away[1] },
  competitionName: `Meeting ${round}`,
  scoredAt: `2026-11-0${round}T22:00:00.000Z`,
});

describe("manager moments: mercato win", () => {
  it("tells the athletes a player won at the reveal of a round in one moment, with the total", () => {
    expect(mercatoMoments([win(1, "x1", "ana", 35), win(1, "x2", "ana", 5)])).toEqual([
      {
        key: "mercato_win:1:ana",
        kind: "mercato_win",
        happenedAt: "2026-11-01T10:00:00.000Z",
        pseudo: "ana",
        round: 1,
        price: 40,
        athletes: [
          { name: "Athlète x1", price: 35 },
          { name: "Athlète x2", price: 5 },
        ],
      },
    ]);
  });

  it("tells one moment per round and player", () => {
    const moments = mercatoMoments([win(1, "x1", "ana"), win(1, "x2", "bob"), win(2, "x3", "ana")]);
    expect(moments.map((m) => m.key)).toEqual([
      "mercato_win:1:ana",
      "mercato_win:1:bob",
      "mercato_win:2:ana",
    ]);
  });

  it("counts an athlete told twice once", () => {
    const [moment] = mercatoMoments([win(1, "x1", "ana", 35), win(1, "x1", "ana", 35)]);
    expect(moment).toMatchObject({ price: 35, athletes: [{ name: "Athlète x1", price: 35 }] });
  });
});

describe("manager moments: duel result", () => {
  it("tells the winner first, with the scores of both teams", () => {
    expect(duelMoments([duel(1, ["ana", 700], ["bob", 900])])).toEqual([
      {
        key: "duel_result:1:ana",
        kind: "duel_result",
        happenedAt: "2026-11-01T22:00:00.000Z",
        pseudo: "bob",
        otherPseudo: "ana",
        competitionName: "Meeting 1",
        scores: [900, 700],
      },
    ]);
  });

  it("tells a draw from the home side", () => {
    const [moment] = duelMoments([duel(2, ["ana", 800], ["bob", 800])]);
    expect(moment).toMatchObject({ pseudo: "ana", otherPseudo: "bob", scores: [800, 800] });
  });
});

describe("manager moments: badge", () => {
  it("names each level a player has just won by the player, the badge and the level", () => {
    expect(badgeMoments("ana", [{ badge: "foudre", level: "silver" }])).toEqual([
      {
        key: "badge:ana:foudre:silver",
        kind: "badge",
        userId: "ana",
        badge: "foudre",
        level: "silver",
      },
    ]);
  });
});

const wins = fc.array(
  fc.record({
    round: fc.integer({ min: 1, max: 5 }),
    athleteId: fc.constantFrom("x1", "x2", "x3", "x4"),
    userId: fc.constantFrom("ana", "bob"),
  }),
  { maxLength: 12 },
);
const duels = fc.array(
  fc.record({
    round: fc.integer({ min: 1, max: 4 }),
    home: fc.constantFrom("ana", "bob", "cid"),
    homeScore: fc.integer({ min: 0, max: 2000 }),
    awayScore: fc.integer({ min: 0, max: 2000 }),
  }),
  { maxLength: 8 },
);
const facts = fc.record({ wins, duels }).map(({ wins, duels }) => ({
  wins: wins.map((w) => win(w.round, w.athleteId, w.userId)),
  duels: duels.map((d) => duel(d.round, [d.home, d.homeScore], ["zed", d.awayScore])),
  published: [],
}));

describe("manager moments: properties", () => {
  it("gives one moment per fact, whatever the order or the repeats of the facts", () => {
    fc.assert(
      fc.property(facts, (f) => {
        const once = managerMoments(f);
        const twice = managerMoments({
          wins: [...f.wins, ...f.wins].reverse(),
          duels: [...f.duels, ...f.duels].reverse(),
          published: [],
        });
        expect(new Set(once.map((m) => m.key)).size).toBe(once.length);
        expect(twice.map((m) => m.key)).toEqual(once.map((m) => m.key));
      }),
    );
  });

  it("publishes nothing new when a badge level is told again", () => {
    const raised = fc.array(
      fc.record({
        badge: fc.constantFrom("foudre", "chasseur", "flair"),
        level: fc.constantFrom("bronze", "silver", "gold"),
      }),
      { maxLength: 6 },
    );
    fc.assert(
      fc.property(raised, (levels) => {
        const first = badgeMoments("ana", levels);
        expect(new Set(first.map((m) => m.key)).size).toBe(first.length);
        const again = badgeMoments("ana", [...levels].reverse());
        expect(
          unpublished(
            first.map((m) => m.key),
            again,
          ),
        ).toEqual([]);
      }),
    );
  });
});
