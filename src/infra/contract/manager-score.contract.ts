import { describe, expect, it } from "vitest";

import type { ManagerScoreLine, ManagerScoreRepository } from "@/application/manager-scores";
import type { ManagerCompetitionScore } from "@/domain/manager-score";

/**
 * A started competition of its own, a Manager league (mercato closed) where `player` lined up the
 * first two athletes, a performance entered for the first one, and the player's prediction points.
 */
export type ManagerScoreWorld = {
  competitionSlug: string;
  competitionId: string;
  leagueId: string;
  playerId: string;
  athleteIds: string[];
  /** Name of each athlete id. */
  names: Record<string, string>;
  admin: ManagerScoreRepository;
  player: ManagerScoreRepository;
  /** A player who is in no Manager league. */
  outsider: ManagerScoreRepository;
};

/** A stored score of the player, worth `total`. */
const line = (w: ManagerScoreWorld, total: number): ManagerScoreLine => ({
  leagueId: w.leagueId,
  userId: w.playerId,
  ...score(w, total),
});

const score = (w: ManagerScoreWorld, total: number): ManagerCompetitionScore => ({
  linedUp: true,
  total,
  hungarian: total - 50 - 3,
  bonus: 50,
  predictions: 3,
  athletes: [
    {
      athleteId: w.athleteIds[0]!,
      discipline: "100 m",
      mark: "10.90",
      status: "ok",
      points: total - 53,
      bonuses: [{ bonus: "first", points: 50 }],
      bonusPoints: 50,
      total: total - 3,
    },
    {
      athleteId: w.athleteIds[1]!,
      discipline: null,
      mark: null,
      status: null,
      points: 0,
      bonuses: [],
      bonusPoints: 0,
      total: 0,
    },
  ],
});

/** Contract of the ManagerScoreRepository port, run against the in-memory fake AND Supabase. */
export function managerScoreContract(name: string, world: () => Promise<ManagerScoreWorld>) {
  describe(`ManagerScoreRepository contract: ${name}`, () => {
    it("gives the admin the sheet of the competition: lineups, performances, predictions", async () => {
      const w = await world();

      const sheet = await w.admin.sheet(w.competitionSlug);

      expect(sheet).toMatchObject({
        competitionId: w.competitionId,
        participants: [
          { leagueId: w.leagueId, userId: w.playerId, lineup: w.athleteIds.slice(0, 2) },
        ],
        performances: [
          {
            athleteId: w.athleteIds[0],
            discipline: "100 m",
            sex: "F",
            unit: "time",
            round: "final",
            status: "ok",
            place: 1,
            mark: "10.90",
            records: ["pb"],
          },
        ],
        predictionPoints: { [w.playerId]: 3 },
      });
      if (sheet && sheet !== "not_admin") {
        expect(sheet.participants[0]!.bonuses.first).toBeGreaterThanOrEqual(0);
        expect(Date.parse(sheet.lockAt)).toBeLessThan(Date.now());
      }
    });

    it("knows no sheet of an unknown competition", async () => {
      const w = await world();
      expect(await w.admin.sheet(`unknown-${crypto.randomUUID()}`)).toBeNull();
    });

    it("refuses the sheet and the scores to a player who is not admin", async () => {
      const w = await world();
      expect(await w.player.sheet(w.competitionSlug)).toBe("not_admin");
      expect(await w.player.replace(w.competitionId, [line(w, 900)])).toBe("not_admin");
      expect(await w.player.mine(w.leagueId, w.competitionId)).toBeNull();
    });

    it("lets the participant read the score the admin stored, with the athletes' names", async () => {
      const w = await world();
      expect(await w.player.mine(w.leagueId, w.competitionId)).toBeNull();

      expect(await w.admin.replace(w.competitionId, [line(w, 900)])).toBe("saved");

      const stored = score(w, 900);
      expect(await w.player.mine(w.leagueId, w.competitionId)).toEqual({
        ...stored,
        athletes: stored.athletes.map((a) => ({ ...a, name: w.names[a.athleteId] })),
      });
    });

    it("replaces the scores of the competition when computed again", async () => {
      const w = await world();
      await w.admin.replace(w.competitionId, [line(w, 900)]);

      await w.admin.replace(w.competitionId, [line(w, 700)]);

      expect((await w.player.mine(w.leagueId, w.competitionId)) as { total: number }).toMatchObject(
        { total: 700 },
      );
    });

    it("does not show the scores of a league to a player outside it", async () => {
      const w = await world();
      await w.admin.replace(w.competitionId, [line(w, 900)]);

      expect(await w.outsider.mine(w.leagueId, w.competitionId)).toBe("not_member");
    });
  });
}
