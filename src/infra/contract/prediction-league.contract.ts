import { describe, expect, it } from "vitest";

import type { PredictionLeagueRepository } from "@/application/prediction-leagues";

/**
 * Seen by the signed-in player: two leagues of theirs counting the competition (`amis`, `club`),
 * one counting another competition (`elsewhere`), their prediction on an open event (`open`), an
 * open event they did not predict (`unpredicted`) and their prediction on a locked one (`locked`).
 */
export type PredictionLeagueContractWorld = {
  player: PredictionLeagueRepository;
  userId: string;
  amis: string;
  club: string;
  elsewhere: string;
  open: string;
  unpredicted: string;
  locked: string;
};

/** Contract of the PredictionLeagueRepository port (#1068), run against the fake AND Supabase. */
export function predictionLeagueContract(
  name: string,
  world: () => Promise<PredictionLeagueContractWorld>,
) {
  describe(`PredictionLeagueRepository contract: ${name}`, () => {
    it("counts a new prediction in no league, then in the leagues chosen", async () => {
      const w = await world();

      expect(await w.player.leaguesOf(w.userId, w.open)).toEqual([]);
      expect(await w.player.set(w.open, [w.amis])).toBe("done");
      expect(await w.player.leaguesOf(w.userId, w.open)).toEqual([w.amis]);
      expect(await w.player.set(w.open, [w.club])).toBe("done");
      expect(await w.player.leaguesOf(w.userId, w.open)).toEqual([w.club]);
      expect(await w.player.set(w.open, [])).toBe("done");
      expect(await w.player.leaguesOf(w.userId, w.open)).toEqual([]);
    });

    it("refuses a league that does not count the competition and an event not predicted", async () => {
      const w = await world();

      expect(await w.player.set(w.open, [w.elsewhere])).toBe("refused");
      expect(await w.player.set(w.unpredicted, [w.amis])).toBe("refused");
      expect(await w.player.leaguesOf(w.userId, w.open)).toEqual([]);
    });

    it("changes nothing once the event is locked", async () => {
      const w = await world();

      expect(await w.player.set(w.locked, [w.amis])).toBe("locked");
      expect(await w.player.leaguesOf(w.userId, w.locked)).toEqual([]);
    });
  });
}
