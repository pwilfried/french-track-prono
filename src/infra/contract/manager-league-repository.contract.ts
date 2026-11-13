import { describe, expect, it } from "vitest";

import type { ManagerLeagueRepository } from "@/application/manager-leagues";

/**
 * Two players, eight competitions open to the Manager (not over, first first), one open to it
 * but over, and a way to change the budget of the rules in force (then put it back).
 */
export type ManagerLeagueWorld = {
  creator: ManagerLeagueRepository;
  creatorId: string;
  other: ManagerLeagueRepository;
  competitions: string[];
  finished: string;
  setBudget: (budget: number) => Promise<void>;
  /** Opens the mercato of a league, whatever its players: nobody joins any more. */
  openMercato: (leagueId: string) => Promise<void>;
  /** Called at the end of every test. */
  restore: () => Promise<void>;
};

/** Runs a test in a world, then restores it. */
const within =
  (world: () => Promise<ManagerLeagueWorld>, test: (w: ManagerLeagueWorld) => Promise<void>) =>
  async () => {
    const w = await world();
    try {
      await test(w);
    } finally {
      await w.restore();
    }
  };

/** Creates a league on the first six competitions of the world. */
async function created(w: ManagerLeagueWorld, name: string, isPublic: boolean) {
  const league = await w.creator.create(name, isPublic, w.competitions.slice(0, 6));
  if (typeof league === "string") throw new Error(`the league is not created: ${league}`);
  return league;
}

/** Contract of the ManagerLeagueRepository port, run against the in-memory fake AND Supabase. */
export function managerLeagueRepositoryContract(
  name: string,
  world: () => Promise<ManagerLeagueWorld>,
) {
  describe(`ManagerLeagueRepository contract: ${name}`, () => {
    it(
      "creates a league its creator is in, with the rules in force kept at creation",
      within(world, async (w) => {
        await w.setBudget(120);
        const league = await created(w, "Les Perchistes", true);
        await w.setBudget(300);

        const found = await w.creator.find(league.id);
        expect(found).toMatchObject({
          name: "Les Perchistes",
          isPublic: true,
          ownerId: w.creatorId,
          memberCount: 1,
          participants: [{ userId: w.creatorId }],
        });
        expect(found?.rules.budget).toBe(120);
        expect((await w.creator.listMine()).map((l) => l.id)).toContain(league.id);
        // Another player does not see it (joining is #420).
        expect(await w.other.find(league.id)).toBeNull();
        expect((await w.other.listMine()).map((l) => l.id)).not.toContain(league.id);
      }),
    );

    it(
      "offers the competitions open to the Manager that are not over, first first",
      within(world, async (w) => {
        const open = (await w.creator.openCompetitions()).map((c) => c.id);
        const mine = open.filter((id) => w.competitions.includes(id));
        expect(mine).toEqual(w.competitions);
        expect(open).not.toContain(w.finished);
      }),
    );

    it(
      "takes the number of players from the competitions chosen, bonus ones aside",
      within(world, async (w) => {
        const six = await created(w, "Six Meetings", false);
        const eight = await w.creator.create("Huit Meetings", false, w.competitions);
        if (typeof eight === "string") throw new Error(eight);

        const league = await w.creator.find(six.id);
        expect(league?.target).toBe(4);
        expect(league?.competitions.map((c) => c.id)).toEqual(w.competitions.slice(0, 6));
        expect((await w.creator.find(eight.id))?.mercato.target).toBe(4);
        expect((await w.creator.find(eight.id))?.competitions).toHaveLength(8);
      }),
    );

    it(
      "refuses a competition that is over, or fewer than 6 competitions",
      within(world, async (w) => {
        expect(
          await w.creator.create("Trop Tard", false, [...w.competitions.slice(0, 5), w.finished]),
        ).toBe("competitions_refused");
        expect(await w.creator.create("Trop Peu", false, w.competitions.slice(0, 5))).toBe(
          "competitions_refused",
        );
      }),
    );

    it(
      "lets a player join a private league with its code, not in one tap",
      within(world, async (w) => {
        const league = await created(w, "Les Haies Basses", false);
        const code = (await w.creator.find(league.id))!.inviteCode;

        expect(await w.other.joinPublic(league.id)).toEqual({ outcome: "unknown" });
        expect((await w.other.listPublic()).map((l) => l.id)).not.toContain(league.id);
        expect(await w.other.join(code)).toEqual({ outcome: "joined", leagueId: league.id });
        expect(await w.other.join(code)).toEqual({ outcome: "joined", leagueId: league.id });
        expect((await w.creator.find(league.id))?.memberCount).toBe(2);
        expect(await w.other.join("ZZZZZZ")).toEqual({ outcome: "unknown" });
      }),
    );

    it(
      "lists a public league with places, joined in one tap until the mercato opens",
      within(world, async (w) => {
        const league = await created(w, "Les Relayeurs", true);

        expect(await w.other.listPublic()).toContainEqual({
          id: league.id,
          name: "Les Relayeurs",
          memberCount: 1,
          target: 4,
        });
        expect(await w.other.joinPublic(league.id)).toEqual({
          outcome: "joined",
          leagueId: league.id,
        });
        expect((await w.other.listPublic()).map((l) => l.id)).not.toContain(league.id);

        const late = await created(w, "Les Retardataires", true);
        await w.openMercato(late.id);
        expect((await w.creator.find(late.id))?.mercato.openedAt).not.toBeNull();
        expect((await w.other.listPublic()).map((l) => l.id)).not.toContain(late.id);
        expect(await w.other.joinPublic(late.id)).toEqual({ outcome: "mercato_open" });
      }),
    );

    it(
      "keeps the mercato its creator sets, and lets them launch it once the players are in",
      within(world, async (w) => {
        const league = await created(w, "Les Lanceurs de Poids", false);
        const code = (await w.creator.find(league.id))!.inviteCode;
        expect((await w.creator.find(league.id))?.mercato).toEqual({
          target: 4,
          startsAt: null,
          openedAt: null,
          roundMode: "auto",
        });

        expect(await w.other.join(code)).toEqual({ outcome: "joined", leagueId: league.id });
        expect(
          await w.creator.setMercato(league.id, {
            startsAt: "2027-01-10T19:00:00.000Z",
            rounds: { mode: "custom", firstHours: 48, nextHours: 12 },
          }),
        ).toBe("set");
        const set = await w.creator.find(league.id);
        expect(set?.mercato).toEqual({
          target: 4,
          startsAt: "2027-01-10T19:00:00.000Z",
          openedAt: null,
          roundMode: "custom",
        });
        expect(set?.rules.rounds).toEqual({ firstHours: 48, longRounds: 1, nextHours: 12 });

        const auto = { startsAt: null, rounds: { mode: "auto" } } as const;
        expect(await w.other.setMercato(league.id, auto)).toBe("not_owner");
        expect(await w.other.launchMercato(league.id)).toBe("not_owner");
        // With 2 players out of 4, the creator cannot launch either.
        expect(await w.creator.launchMercato(league.id)).toBe("players_missing");
        await w.openMercato(league.id);
        expect(await w.creator.launchMercato(league.id)).toBe("mercato_open");
        expect(await w.creator.setMercato(league.id, auto)).toBe("mercato_open");
      }),
    );

    it(
      "refuses a banned name",
      within(world, async (w) => {
        expect(await w.creator.create("Ligue FFA", false, w.competitions.slice(0, 6))).toBe(
          "banned",
        );
      }),
    );
  });
}
