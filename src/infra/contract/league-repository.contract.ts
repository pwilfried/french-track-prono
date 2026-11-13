import { describe, expect, it } from "vitest";

import type { LeagueRepository } from "@/application/leagues";

export type LeaguePlayer = { userId: string; leagues: LeagueRepository };

/** Contract of the LeagueRepository port, run against the in-memory fake AND Supabase. */
export function leagueRepositoryContract(
  name: string,
  setup: () => Promise<{
    newPlayer: () => Promise<LeaguePlayer>;
    competitionSlug: string;
    /** A second competition, for a league on several; it has already started. */
    otherCompetitionSlug: string;
    /** A competition still to come, that a league can add later. */
    comingCompetitionSlug: string;
  }>,
) {
  describe(`LeagueRepository contract: ${name}`, () => {
    it("creates a league whose owner is the first member, with an easy invite code", async () => {
      const { newPlayer, competitionSlug } = await setup();
      const owner = await newPlayer();

      const league = await owner.leagues.create("Les Foulées", [competitionSlug], false);

      expect(league.inviteCode).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/);
      expect(await owner.leagues.listMine()).toEqual([
        {
          id: league.id,
          name: "Les Foulées",
          inviteCode: league.inviteCode,
          ownerId: owner.userId,
          memberCount: 1,
          competitionSlugs: [competitionSlug],
          isPublic: false,
        },
      ]);
    });

    it("creates a league on several competitions", async () => {
      const { newPlayer, competitionSlug, otherCompetitionSlug } = await setup();
      const owner = await newPlayer();

      const league = await owner.leagues.create(
        "Deux",
        [otherCompetitionSlug, competitionSlug],
        false,
      );

      const expected = [competitionSlug, otherCompetitionSlug].sort();
      expect(league.competitionSlugs).toEqual(expected);
      expect((await owner.leagues.listMine())[0]?.competitionSlugs).toEqual(expected);
    });

    it("creates a league without competition, then its creator adds a coming one", async () => {
      const { newPlayer, comingCompetitionSlug } = await setup();
      const owner = await newPlayer();
      const league = await owner.leagues.create("Plus tard", [], false);
      expect(league.competitionSlugs).toEqual([]);

      expect(await owner.leagues.addCompetition(league.id, comingCompetitionSlug)).toBe("added");
      expect(await owner.leagues.addCompetition(league.id, comingCompetitionSlug)).toBe("added");

      expect((await owner.leagues.listMine())[0]?.competitionSlugs).toEqual([
        comingCompetitionSlug,
      ]);
    });

    it("refuses a started or unknown competition, and a player who is not the creator", async () => {
      const { newPlayer, otherCompetitionSlug, comingCompetitionSlug } = await setup();
      const [owner, friend] = [await newPlayer(), await newPlayer()];
      const league = await owner.leagues.create("Club", [], false);
      await friend.leagues.join(league.inviteCode);

      expect(await owner.leagues.addCompetition(league.id, otherCompetitionSlug)).toBe("started");
      expect(await owner.leagues.addCompetition(league.id, "no-such-competition")).toBe("unknown");
      expect(await friend.leagues.addCompetition(league.id, comingCompetitionSlug)).toBe(
        "not_owner",
      );
      expect((await owner.leagues.listMine())[0]?.competitionSlugs).toEqual([]);
    });

    it("lists a public league, which a friend joins without the code", async () => {
      const { newPlayer, competitionSlug } = await setup();
      const [owner, friend] = [await newPlayer(), await newPlayer()];
      const pub = await owner.leagues.create(
        `Publique ${crypto.randomUUID().slice(0, 8)}`,
        [competitionSlug],
        true,
      );
      const priv = await owner.leagues.create("Privée", [competitionSlug], false);
      expect(pub.isPublic).toBe(true);

      const listed = await friend.leagues.listPublic();
      expect(listed.find((l) => l.id === pub.id)).toEqual({
        id: pub.id,
        name: pub.name,
        memberCount: 1,
        competitionSlugs: [competitionSlug],
      });
      expect(listed.some((l) => l.id === priv.id)).toBe(false);

      expect(await friend.leagues.joinPublic(pub.id)).toEqual({
        outcome: "joined",
        leagueId: pub.id,
      });
      expect(await friend.leagues.joinPublic(pub.id)).toEqual({
        outcome: "already_member",
        leagueId: pub.id,
      });
      expect(await friend.leagues.joinPublic(priv.id)).toEqual({ outcome: "unknown_code" });
    });

    it("refuses a banned name for a public league", async () => {
      const { newPlayer } = await setup();
      const owner = await newPlayer();

      await expect(owner.leagues.create("Ligue officielle", [], true)).rejects.toMatchObject({
        code: "LEAGUE_NAME_BANNED",
      });
    });

    it("creates a league limited to families; its creator adds one, never removes any (#613)", async () => {
      const { newPlayer, competitionSlug } = await setup();
      const [owner, friend] = [await newPlayer(), await newPlayer()];
      const league = await owner.leagues.create("Sprint 613", [competitionSlug], true, [
        "sprint",
        "hurdles",
      ]);
      expect(league.families).toEqual([
        { family: "sprint", addedAt: null },
        { family: "hurdles", addedAt: null },
      ]);
      await friend.leagues.joinPublic(league.id);

      expect(await friend.leagues.addFamily(league.id, "throws")).toBe("not_owner");
      expect(await owner.leagues.addFamily(league.id, "throws")).toBe("added");
      expect(await owner.leagues.addFamily(league.id, "sprint")).toBe("added");

      const seen = (await friend.leagues.listMine()).find((l) => l.id === league.id)!;
      expect(seen.families!.map((f) => [f.family, f.addedAt === null])).toEqual([
        ["sprint", true],
        ["hurdles", true],
        ["throws", false],
      ]);
      expect(Number.isNaN(Date.parse(seen.families![2]!.addedAt!))).toBe(false);
      const listed = (await newPlayer()).leagues.listPublic();
      expect((await listed).find((l) => l.id === league.id)?.families).toEqual([
        "sprint",
        "hurdles",
        "throws",
      ]);
    });

    it("adds no family to a league on all events", async () => {
      const { newPlayer, competitionSlug } = await setup();
      const owner = await newPlayer();
      const league = await owner.leagues.create("Tout 613", [competitionSlug], false, []);

      expect(await owner.leagues.addFamily(league.id, "throws")).toBe("all_events");
      expect((await owner.leagues.listMine())[0]!.families).toBeUndefined();
    });

    it("refuses to join with a code after ten wrong codes", async () => {
      const { newPlayer, competitionSlug } = await setup();
      const [owner, guesser] = [await newPlayer(), await newPlayer()];
      const league = await owner.leagues.create("Cible", [competitionSlug], false);

      for (let i = 0; i < 10; i += 1) {
        expect(await guesser.leagues.join(`WRNG${String(i).padStart(2, "2")}`)).toEqual({
          outcome: "unknown_code",
        });
      }

      expect(await guesser.leagues.join(league.inviteCode)).toEqual({ outcome: "too_many" });
    });

    it("lets a friend join with the code, once", async () => {
      const { newPlayer, competitionSlug } = await setup();
      const [owner, friend] = [await newPlayer(), await newPlayer()];
      const league = await owner.leagues.create("Club", [competitionSlug], false);

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
      const league = await owner.leagues.create("Privé", [competitionSlug], false);

      expect(await stranger.leagues.members(league.id)).toBeNull();
      expect(await stranger.leagues.listMine()).toEqual([]);
    });

    it("asks the owner to hand the league over before leaving, then lets him go", async () => {
      const { newPlayer, competitionSlug } = await setup();
      const [owner, friend] = [await newPlayer(), await newPlayer()];
      const league = await owner.leagues.create("Relais", [competitionSlug], false);
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
      const league = await owner.leagues.create("Solo", [competitionSlug], false);

      expect(await owner.leagues.leave(league.id)).toBe("left");

      expect(await owner.leagues.listMine()).toEqual([]);
    });
  });
}
