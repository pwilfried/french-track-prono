import { describe, expect, it } from "vitest";

import type { FeedMoment, LeagueMoment } from "@/domain/league-moments";

import { UseCaseError } from "./errors";
import {
  getLeagueFeed,
  publishLeagueMoments,
  type LeagueMomentRepository,
  type MomentLeague,
} from "./league-moments";
import type { RankingLine, RankingRepository } from "./rankings";

const line = (userId: string, eventId: string, points: number, perfect = false): RankingLine => ({
  userId,
  pseudo: userId.toUpperCase(),
  bib: { number: 7, color: "blue" },
  points,
  reasons: perfect ? [{ kind: "perfect_podium" }] : [],
  eventId,
  eventStartsAt: `2026-11-15T19:00:00.000Z`,
  eventLockAt: `2026-11-15T19:00:00.000Z`,
});

/** A small store: the moments published by league, the feed read as `viewer`. */
function store(leagues: MomentLeague[], options: { admin?: boolean; viewer?: string } = {}) {
  const published = new Map<string, LeagueMoment[]>();
  const repository: LeagueMomentRepository = {
    leaguesOf: async (slug) =>
      options.admin === false
        ? "not_admin"
        : leagues.filter((l) => l.competitionSlugs.includes(slug)),
    publish: async (leagueId, moments) => {
      const known = published.get(leagueId) ?? [];
      const fresh = moments.filter((m) => !known.some((k) => k.key === m.key));
      published.set(leagueId, [...known, ...fresh]);
      return fresh.length;
    },
    feed: async (leagueId) => {
      const league = leagues.find((l) => l.id === leagueId);
      if (!league?.members.some((m) => m.userId === options.viewer)) return [];
      return (published.get(leagueId) ?? []).map((m): FeedMoment => ({
        key: m.key,
        kind: m.kind,
        happenedAt: "2026-11-15T19:00:00.000Z",
        pseudo: m.userId.toUpperCase(),
        competitionName: "Meeting",
      }));
    },
  };
  return { repository, published };
}

const ranking = (lines: Record<string, RankingLine[]>): RankingRepository => ({
  competitionLines: async (slug) => lines[slug] ?? [],
});

const friends: MomentLeague = {
  id: "friends",
  competitionSlugs: ["meeting"],
  members: [{ userId: "ana" }, { userId: "bob" }],
};

describe("league feed", () => {
  it("shows a perfect podium in the feed of the player's league once the points are computed", async () => {
    // Given Ana and Bob in a league, and Ana's perfect podium on the 100 m
    const { repository } = store([friends], { viewer: "bob" });
    const lines = { meeting: [line("ana", "100m", 25, true), line("bob", "100m", 4)] };

    // When the admin's computation publishes the moments, then Bob opens the feed
    await publishLeagueMoments({ moments: repository, ranking: ranking(lines) }).execute({
      competitionSlug: "meeting",
    });
    const groups = await getLeagueFeed({
      moments: repository,
      now: () => new Date("2026-11-15T21:00:00.000Z"),
    }).execute({ leagueId: "friends" });

    // Then the feed tells Ana's perfect podium tonight
    expect(groups).toHaveLength(1);
    expect(groups[0]!.title).toEqual({ kind: "tonight", competitionName: "Meeting" });
    expect(groups[0]!.moments.map((m) => [m.kind, m.pseudo])).toContainEqual([
      "perfect_podium",
      "ANA",
    ]);
  });

  it("publishes nothing new when the points are computed again", async () => {
    const { repository } = store([friends]);
    const ports = {
      moments: repository,
      ranking: ranking({ meeting: [line("ana", "100m", 25, true)] }),
    };

    expect(await publishLeagueMoments(ports).execute({ competitionSlug: "meeting" })).toBe(2);
    expect(await publishLeagueMoments(ports).execute({ competitionSlug: "meeting" })).toBe(0);
  });

  it("tells only what the league counts: a player who joined after the event is left out", async () => {
    const late: MomentLeague = {
      ...friends,
      members: [{ userId: "ana", joinedAt: "2026-11-16T00:00:00.000Z" }, { userId: "bob" }],
    };
    const { repository, published } = store([late]);
    await publishLeagueMoments({
      moments: repository,
      ranking: ranking({ meeting: [line("ana", "100m", 25, true)] }),
    }).execute({ competitionSlug: "meeting" });

    expect(published.get("friends") ?? []).toEqual([]);
  });

  it("refuses a player who is not an admin", async () => {
    const { repository } = store([friends], { admin: false });
    await expect(
      publishLeagueMoments({ moments: repository, ranking: ranking({}) }).execute({
        competitionSlug: "meeting",
      }),
    ).rejects.toEqual(new UseCaseError("NOT_ADMIN"));
  });

  it("shows an empty feed to someone outside the league", async () => {
    const { repository } = store([friends], { viewer: "cid" });
    expect(await getLeagueFeed({ moments: repository }).execute({ leagueId: "friends" })).toEqual(
      [],
    );
  });
});
