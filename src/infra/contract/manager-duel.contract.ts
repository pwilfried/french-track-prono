import { describe, expect, it } from "vitest";

import type { ManagerDuelRepository } from "@/application/manager-duel";

/**
 * A Manager league of two players: `locked` is a competition whose lineups are locked, both
 * players lined up (`first` with `firstLineup`) and scored (`first` 900,
 * `firstLineup[0]` 850 on the 100 m in 10.90, with the bonus of a win, 20); `open` is a competition not locked yet, where both
 * players lined up too.
 */
export type ManagerDuelWorld = {
  leagueId: string;
  firstId: string;
  secondId: string;
  locked: string;
  open: string;
  firstLineup: string[];
  player: ManagerDuelRepository;
  /** A player who is not in the league. */
  outsider: ManagerDuelRepository;
};

/** Contract of the ManagerDuelRepository port, run against the in-memory fake AND Supabase. */
export function managerDuelContract(name: string, world: () => Promise<ManagerDuelWorld>) {
  describe(`ManagerDuelRepository contract: ${name}`, () => {
    it("keeps every lineup secret before the lock, even the opponent's", async () => {
      const w = await world();

      expect(await w.player.lineups(w.leagueId, w.open)).toEqual({ locked: false, lineups: [] });
    });

    it("gives every lineup of a locked competition, athletes in their order", async () => {
      const w = await world();

      const result = await w.player.lineups(w.leagueId, w.locked);

      expect(result).not.toBe("not_member");
      if (result === "not_member") return;
      expect(result.locked).toBe(true);
      expect(result.lineups.map((l) => l.userId).sort()).toEqual([w.firstId, w.secondId].sort());
      expect(result.lineups.find((l) => l.userId === w.firstId)?.athleteIds).toEqual(w.firstLineup);
    });

    it("gives the scores of the competition with each athlete's points", async () => {
      const w = await world();

      const scores = await w.player.scores(w.leagueId, w.locked);

      expect(scores.find((s) => s.userId === w.firstId)).toEqual({
        userId: w.firstId,
        total: 900,
        athletes: [
          {
            athleteId: w.firstLineup[0],
            discipline: "100 m",
            mark: "10.90",
            status: "ok",
            tablePoints: 8305,
            points: 830,
            bonuses: [{ bonus: "first", points: 20 }],
            bonusPoints: 20,
            total: 850,
          },
        ],
        jokerEffects: [],
      });
      expect(await w.player.scores(w.leagueId, w.open)).toEqual([]);
    });

    it("shows nothing of the league to a player outside it", async () => {
      const w = await world();

      expect(await w.outsider.lineups(w.leagueId, w.locked)).toBe("not_member");
      expect(await w.outsider.scores(w.leagueId, w.locked)).toEqual([]);
    });
  });
}
