import { describe, expect, it } from "vitest";

import type { ManagerHonoursRepository } from "@/application/manager-honours";

/**
 * Two Manager leagues of two players. « Finished »: two head-to-head matchdays then a bonus one,
 * all scored; `first` won both head-to-heads (900 – 700, 800 – 600) and scored 1800 Manager
 * points, `second` 1300 plus 5000 on the bonus matchday; `first` lined up `athleteName`, worth
 * 900 then 800. « Playing »: its bonus matchday is not scored yet.
 */
export type ManagerHonoursWorld = {
  finishedId: string;
  finishedName: string;
  playingId: string;
  firstId: string;
  secondId: string;
  athleteName: string;
  player: ManagerHonoursRepository;
  /** A player who is in neither league. */
  outsider: ManagerHonoursRepository;
};

/** Contract of the ManagerHonoursRepository port, run against the in-memory fake AND Supabase. */
export function managerHonoursContract(name: string, world: () => Promise<ManagerHonoursWorld>) {
  describe(`ManagerHonoursRepository contract: ${name}`, () => {
    it("gives a participant the champion and the final standings of a finished season", async () => {
      const w = await world();

      const honours = await w.player.find(w.finishedId);

      expect(honours).toMatchObject({
        leagueId: w.finishedId,
        leagueName: w.finishedName,
        championId: w.firstId,
      });
      expect(honours!.standings).toEqual([
        {
          userId: w.firstId,
          rank: 1,
          played: 2,
          wins: 2,
          draws: 0,
          losses: 0,
          scored: 1700,
          conceded: 1300,
          difference: 400,
          points: 6,
        },
        {
          userId: w.secondId,
          rank: 2,
          played: 2,
          wins: 0,
          draws: 0,
          losses: 2,
          scored: 1300,
          conceded: 1700,
          difference: -400,
          points: 0,
        },
      ]);
      expect(Number.isNaN(Date.parse(honours!.endedAt))).toBe(false);
    });

    it("keeps every head-to-head and each player's season figures", async () => {
      const w = await world();

      const honours = (await w.player.find(w.finishedId))!;

      expect(honours.duels.map((d) => [d.round, d.homeScore + d.awayScore])).toEqual([
        [1, 1600],
        [2, 1400],
      ]);
      expect([...honours.players].sort((a, b) => b.managerPoints - a.managerPoints)).toEqual([
        { userId: w.secondId, managerPoints: 6300, bestAthlete: null },
        {
          userId: w.firstId,
          managerPoints: 1800,
          bestAthlete: { name: w.athleteName, points: 1700 },
        },
      ]);
    });

    it("has no honours for a season still playing", async () => {
      const w = await world();

      expect(await w.player.find(w.playingId)).toBeNull();
      expect((await w.player.mine()).map((h) => h.leagueId)).toContain(w.finishedId);
      expect((await w.player.mine()).map((h) => h.leagueId)).not.toContain(w.playingId);
    });

    it("shows nothing to a player outside the league", async () => {
      const w = await world();

      expect(await w.outsider.find(w.finishedId)).toBeNull();
      expect(await w.outsider.mine()).toEqual([]);
    });
  });
}
