import { describe, expect, it } from "vitest";

import type { LeagueRepository } from "@/application/leagues";

export type LeaguePlayer = { userId: string; leagues: LeagueRepository };

/** Contract of the LeagueRepository port, run against the in-memory fake AND Supabase. */
export function leagueRepositoryContract(
  name: string,
  setup: () => Promise<{
    newPlayer: () => Promise<LeaguePlayer>;
    competitionSlug: string;
    /** A second competition, for a league on several. */
    otherCompetitionSlug: string;
  }>,
) {
  describe(`LeagueRepository contract: ${name}`, () => {
    it("creates a league whose owner is the first member, with an easy invite code", async () => {
      const { newPlayer, competitionSlug } = await setup();
      const owner = await newPlayer();

      const league = await owner.leagues.create("Les Foulées", [competitionSlug]);

      expect(league.inviteCode).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/);
      expect(await owner.leagues.listMine()).toEqual([
        {
          id: league.id,
          name: "Les Foulées",
          inviteCode: league.inviteCode,
          ownerId: owner.userId,
          memberCount: 1,
          competitionSlugs: [competitionSlug],
        },
      ]);
    });

    it("creates a league on several competitions", async () => {
      const { newPlayer, competitionSlug, otherCompetitionSlug } = await setup();
      const owner = await newPlayer();

      const league = await owner.leagues.create("Deux", [otherCompetitionSlug, competitionSlug]);

      const expected = [competitionSlug, otherCompetitionSlug].sort();
      expect(league.competitionSlugs).toEqual(expected);
      expect((await owner.leagues.listMine())[0]?.competitionSlugs).toEqual(expected);
    });

    it("lets a friend join with the code, once", async () => {
      const { newPlayer, competitionSlug } = await setup();
      const [owner, friend] = [await newPlayer(), await newPlayer()];
      const league = await owner.leagues.create("Club", [competitionSlug]);

      expect(await friend.leagues.join(league.inviteCode)).toEqual({
        outcome: "joined",
        leagueId: league.id,
      });
      expect(await friend.leagues.join(league.inviteCode)).toEqual({
        outcome: "already_member",
        leagueId: league.id,
      });

      expect((await owner.leagues.members(league.id))!.map((m) => m.userId).sort()).toEqual(
        [owner.userId, friend.userId].sort(),
      );
    });

    it("refuses an unknown code", async () => {
      const { newPlayer } = await setup();
      const player = await newPlayer();

      expect(await player.leagues.join("ZZZZZZ")).toEqual({ outcome: "unknown_code" });
    });

    it("hides a league from a player who is not a member", async () => {
      const { newPlayer, competitionSlug } = await setup();
      const [owner, stranger] = [await newPlayer(), await newPlayer()];
      const league = await owner.leagues.create("Privé", [competitionSlug]);

      expect(await stranger.leagues.members(league.id)).toBeNull();
      expect(await stranger.leagues.listMine()).toEqual([]);
    });

    it("asks the owner to hand the league over before leaving, then lets him go", async () => {
      const { newPlayer, competitionSlug } = await setup();
      const [owner, friend] = [await newPlayer(), await newPlayer()];
      const league = await owner.leagues.create("Relais", [competitionSlug]);
      await friend.leagues.join(league.inviteCode);

      expect(await owner.leagues.leave(league.id)).toBe("must_hand_over");
      expect(await friend.leagues.handOver(league.id, friend.userId)).toBe("not_owner");
      expect(await owner.leagues.handOver(league.id, crypto.randomUUID())).toBe("unknown_member");
      expect(await owner.leagues.handOver(league.id, friend.userId)).toBe("done");
      expect(await owner.leagues.leave(league.id)).toBe("left");

      expect((await friend.leagues.listMine())[0]).toMatchObject({
        ownerId: friend.userId,
        memberCount: 1,
      });
    });

    it("deletes the league when its owner leaves alone", async () => {
      const { newPlayer, competitionSlug } = await setup();
      const owner = await newPlayer();
      const league = await owner.leagues.create("Solo", [competitionSlug]);

      expect(await owner.leagues.leave(league.id)).toBe("left");

      expect(await owner.leagues.listMine()).toEqual([]);
    });
  });
}
