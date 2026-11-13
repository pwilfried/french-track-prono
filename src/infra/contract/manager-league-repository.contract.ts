import { describe, expect, it } from "vitest";

import type { ManagerLeagueRepository } from "@/application/manager-leagues";

/**
 * Two players, 10 competitions a league can be created with (first one first, far ahead; the first
 * one in Oslo, of level « continental-tour-gold », the others without city nor level), and a
 * way to change the budget of the rules in force (then put it back).
 */
export type ManagerLeagueWorld = {
  competitionIds: string[];
  creator: ManagerLeagueRepository;
  creatorId: string;
  other: ManagerLeagueRepository;
  setBudget: (budget: number) => Promise<void>;
  /** Opens the mercato of a league, whatever its players: nobody joins any more. */
  openMercato: (leagueId: string) => Promise<void>;
  restore: () => Promise<void>;
};

/** Contract of the ManagerLeagueRepository port, run against the in-memory fake AND Supabase. */
export function managerLeagueRepositoryContract(
  name: string,
  world: () => Promise<ManagerLeagueWorld>,
) {
  describe(`ManagerLeagueRepository contract: ${name}`, () => {
    it("creates a league its creator is in, with the rules in force kept at creation", async () => {
      const w = await world();
      try {
        await w.setBudget(120);
        const created = await w.creator.create(
          "Les Perchistes",
          true,
          w.competitionIds.slice(0, 6),
        );
        if (typeof created === "string") throw new Error("the league is created");
        await w.setBudget(300);

        const league = await w.creator.find(created.id);
        expect(league).toMatchObject({
          name: "Les Perchistes",
          isPublic: true,
          ownerId: w.creatorId,
          memberCount: 1,
          participants: [{ userId: w.creatorId }],
        });
        expect(league?.rules.budget).toBe(120);
        expect((await w.creator.listMine()).map((l) => l.id)).toContain(created.id);
        // Another player does not see it (joining is #420).
        expect(await w.other.find(created.id)).toBeNull();
        expect((await w.other.listMine()).map((l) => l.id)).not.toContain(created.id);
      } finally {
        await w.restore();
      }
    });

    it("lets a player join a private league with its code, not in one tap", async () => {
      const w = await world();
      const created = await w.creator.create(
        "Les Haies Basses",
        false,
        w.competitionIds.slice(0, 6),
      );
      if (typeof created === "string") throw new Error("the league is created");
      const code = (await w.creator.find(created.id))!.inviteCode;

      expect(await w.other.joinPublic(created.id)).toEqual({ outcome: "unknown" });
      expect((await w.other.listPublic()).map((l) => l.id)).not.toContain(created.id);
      expect(await w.other.join(code)).toEqual({ outcome: "joined", leagueId: created.id });
      expect(await w.other.join(code)).toEqual({ outcome: "joined", leagueId: created.id });
      expect((await w.creator.find(created.id))?.memberCount).toBe(2);
      expect(await w.other.join("ZZZZZZ")).toEqual({ outcome: "unknown" });
    });

    it("lists a public league with places, joined in one tap until the mercato opens", async () => {
      const w = await world();
      const created = await w.creator.create("Les Relayeurs", true, w.competitionIds.slice(0, 6));
      if (typeof created === "string") throw new Error("the league is created");

      expect(await w.other.listPublic()).toContainEqual({
        id: created.id,
        name: "Les Relayeurs",
        memberCount: 1,
        target: 4,
      });
      expect(await w.other.joinPublic(created.id)).toEqual({
        outcome: "joined",
        leagueId: created.id,
      });
      expect((await w.other.listPublic()).map((l) => l.id)).not.toContain(created.id);

      const late = await w.creator.create("Les Retardataires", true, w.competitionIds.slice(0, 6));
      if (typeof late === "string") throw new Error("the league is created");
      await w.openMercato(late.id);
      expect((await w.creator.find(late.id))?.mercato.openedAt).not.toBeNull();
      expect((await w.other.listPublic()).map((l) => l.id)).not.toContain(late.id);
      expect(await w.other.joinPublic(late.id)).toEqual({ outcome: "mercato_open" });
    });

    it("offers the competitions a league can be created with, and refuses fewer than 6", async () => {
      const w = await world();
      const available = (await w.creator.availableCompetitions()).map((c) => c.id);
      expect(available).toEqual(expect.arrayContaining(w.competitionIds));

      expect(await w.creator.create("Les Marcheurs", false, w.competitionIds.slice(0, 5))).toBe(
        "competitions_refused",
      );
      expect(
        await w.creator.create("Les Marcheurs", false, [
          ...w.competitionIds.slice(0, 5),
          "00000000-0000-0000-0000-000000000000",
        ]),
      ).toBe("competitions_refused");
    });

    it("tells the city, scope, venue and level of each competition for the picker", async () => {
      const w = await world();
      const first = (await w.creator.availableCompetitions()).find(
        (c) => c.id === w.competitionIds[0],
      );
      expect(first).toMatchObject({
        city: "Oslo",
        scope: "international",
        venue: "outdoor",
        level: "continental-tour-gold",
      });
      const second = (await w.creator.availableCompetitions()).find(
        (c) => c.id === w.competitionIds[1],
      );
      expect(second).toMatchObject({ city: null, level: null });
    });

    it("derives the players from the competitions, first one first", async () => {
      const w = await world();
      const created = await w.creator.create(
        "Les Hurdlers",
        false,
        [...w.competitionIds.slice(0, 8)].reverse(),
      );
      if (typeof created === "string") throw new Error("the league is created");
      const league = await w.creator.find(created.id);
      expect(league?.mercato.target).toBe(4);
      expect(league?.competitions.map((c) => c.id)).toEqual(w.competitionIds.slice(0, 8));

      // 10 competitions: 6 players; then back to 6 competitions while 2 players are in.
      expect(await w.creator.setCompetitions(created.id, w.competitionIds)).toBe("set");
      expect((await w.creator.find(created.id))?.mercato.target).toBe(6);
      const code = (await w.creator.find(created.id))!.inviteCode;
      expect(await w.other.join(code)).toEqual({ outcome: "joined", leagueId: created.id });
      expect(await w.other.setCompetitions(created.id, w.competitionIds)).toBe("not_owner");
      expect(await w.creator.setCompetitions(created.id, w.competitionIds.slice(0, 6))).toBe("set");
      expect((await w.creator.find(created.id))?.competitions).toHaveLength(6);
      expect((await w.creator.find(created.id))?.mercato.target).toBe(4);
      await w.openMercato(created.id);
      expect(await w.creator.setCompetitions(created.id, w.competitionIds)).toBe("mercato_open");
    });

    it("keeps the mercato its creator sets, and lets them launch it once the players are in", async () => {
      const w = await world();
      const created = await w.creator.create(
        "Les Lanceurs de Poids",
        false,
        w.competitionIds.slice(0, 6),
      );
      if (typeof created === "string") throw new Error("the league is created");
      const code = (await w.creator.find(created.id))!.inviteCode;
      expect((await w.creator.find(created.id))?.mercato).toEqual({
        target: 4,
        startsAt: null,
        openedAt: null,
        roundMode: "auto",
      });

      expect(await w.other.join(code)).toEqual({ outcome: "joined", leagueId: created.id });
      expect(
        await w.creator.setMercato(created.id, {
          startsAt: "2027-01-10T19:00:00.000Z",
          rounds: { mode: "custom", firstHours: 48, nextHours: 12 },
        }),
      ).toBe("set");
      const set = await w.creator.find(created.id);
      expect(set?.mercato).toEqual({
        target: 4,
        startsAt: "2027-01-10T19:00:00.000Z",
        openedAt: null,
        roundMode: "custom",
      });
      expect(set?.rules.rounds).toEqual({ firstHours: 48, longRounds: 1, nextHours: 12 });

      expect(
        await w.other.setMercato(created.id, { startsAt: null, rounds: { mode: "auto" } }),
      ).toBe("not_owner");
      expect(await w.other.launchMercato(created.id)).toBe("not_owner");
      // With 2 players out of 4, the creator cannot launch either.
      expect(await w.creator.launchMercato(created.id)).toBe("players_missing");
      await w.openMercato(created.id);
      expect(await w.creator.launchMercato(created.id)).toBe("mercato_open");
      expect(
        await w.creator.setMercato(created.id, { startsAt: null, rounds: { mode: "auto" } }),
      ).toBe("mercato_open");
    });

    it("refuses a banned name", async () => {
      const w = await world();
      expect(await w.creator.create("Ligue FFA", false, w.competitionIds.slice(0, 6))).toBe(
        "banned",
      );
    });
  });
}
