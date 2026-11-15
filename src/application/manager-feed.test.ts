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
      { kind: "mercato_win", pseudo: "Ana", athlete: "Athlète X", price: 35 },
    ]);
    expect(groups[1].moments).toMatchObject([
      { kind: "duel_result", pseudo: "Bob", otherPseudo: "Ana", scores: [900, 700] },
    ]);
  });

  it("shows an empty feed to someone outside the league", async () => {
    const groups = await getManagerFeed({ feed: feed({ L: facts }) }).execute({
      leagueId: "other",
    });
    expect(groups).toEqual([]);
  });
});
