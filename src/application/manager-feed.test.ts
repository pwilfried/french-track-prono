import { describe, expect, it } from "vitest";

import type { ManagerFacts } from "@/domain/manager-moments";

import { getManagerFeed, type ManagerFeedRepository } from "./manager-feed";

const facts: ManagerFacts = {
  wins: [
    {
      round: 1,
      athleteId: "x1",
      athlete: "Athlète X",
      price: 35,
      userId: "ana",
      pseudo: "Ana",
      closedAt: "2026-11-15T09:00:00.000Z",
    },
  ],
  duels: [
    {
      round: 1,
      home: { userId: "ana", pseudo: "Ana", score: 700 },
      away: { userId: "bob", pseudo: "Bob", score: 900 },
      competitionName: "Meeting",
      scoredAt: "2026-11-14T21:00:00.000Z",
    },
  ],
  published: [],
};

// Application tests do not import the infra layer: one line of fake is enough here.
const feed = (byLeague: Record<string, ManagerFacts>): ManagerFeedRepository => ({
  facts: async (leagueId) => byLeague[leagueId] ?? { wins: [], duels: [], published: [] },
});

describe("getManagerFeed", () => {
  it("tells the reveal of a round tonight and yesterday's duel, latest first", async () => {
    // Given a round revealed this morning and a duel scored last night,
    const groups = await getManagerFeed({
      feed: feed({ L: facts }),
      now: () => new Date("2026-11-15T20:00:00.000Z"),
    }).execute({ leagueId: "L" });

    // then the feed tells the mercato first, then the duel, winner first.
    expect(groups.map((g) => g.title.kind)).toEqual(["tonight", "yesterday"]);
    expect(groups[0].moments).toMatchObject([
      {
        kind: "mercato_win",
        pseudo: "Ana",
        round: 1,
        price: 35,
        athletes: [{ name: "Athlète X" }],
      },
    ]);
    expect(groups[1].moments).toMatchObject([
      { kind: "duel_result", pseudo: "Bob", otherPseudo: "Ana", scores: [900, 700] },
    ]);
  });

  it("groups the athletes won in a round by player, duels and badges apart", async () => {
    // Given a full round: Ana wins three athletes, Bob one, then a duel and a badge,
    const won = (athleteId: string, userId: string, pseudo: string, price: number) => ({
      round: 1,
      athleteId,
      athlete: `Athlète ${athleteId}`,
      price,
      userId,
      pseudo,
      closedAt: "2026-11-15T09:00:00.000Z",
    });
    const groups = await getManagerFeed({
      feed: feed({
        L: {
          wins: [
            won("a1", "ana", "Ana", 20),
            won("b1", "bob", "Bob", 12),
            won("a2", "ana", "Ana", 15),
            won("a3", "ana", "Ana", 5),
          ],
          duels: facts.duels,
          published: [
            {
              key: "badge:bob:foudre:silver",
              kind: "badge",
              happenedAt: "2026-11-15T10:00:00.000Z",
              pseudo: "Bob",
              badge: "foudre",
              level: "silver",
            },
          ],
        },
      }),
      now: () => new Date("2026-11-15T20:00:00.000Z"),
    }).execute({ leagueId: "L" });

    // then the feed tells one card per player for the round, the duel and the badge apart.
    const moments = groups.flatMap((g) => g.moments);
    expect(moments.map((m) => m.kind)).toEqual([
      "badge",
      "mercato_win",
      "mercato_win",
      "duel_result",
    ]);
    expect(moments[1]).toMatchObject({ pseudo: "Ana", round: 1, price: 40 });
    expect(moments[1].athletes?.map((a) => a.name)).toEqual([
      "Athlète a1",
      "Athlète a2",
      "Athlète a3",
    ]);
    expect(moments[2]).toMatchObject({
      pseudo: "Bob",
      price: 12,
      athletes: [{ name: "Athlète b1" }],
    });
  });

  it("shows an empty feed to someone outside the league", async () => {
    const groups = await getManagerFeed({ feed: feed({ L: facts }) }).execute({
      leagueId: "other",
    });
    expect(groups).toEqual([]);
  });
});
