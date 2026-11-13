import { describe, expect, it } from "vitest";

import type { ManagerSeasonRepository } from "@/application/manager-championship";

/**
 * A Manager league of two players whose mercato closed: three competitions of the league, first
 * one first (two head-to-head matchdays, then a bonus one); the first competition is scored,
 * `first` 900 and `second` 700.
 */
export type ManagerSeasonWorld = {
  leagueId: string;
  firstId: string;
  secondId: string;
  competitions: { id: string; name: string }[];
  player: ManagerSeasonRepository;
  /** A player who is not in the league. */
  outsider: ManagerSeasonRepository;
};

/** Contract of the ManagerSeasonRepository port, run against the in-memory fake AND Supabase. */
export function managerSeasonContract(name: string, world: () => Promise<ManagerSeasonWorld>) {
  describe(`ManagerSeasonRepository contract: ${name}`, () => {
    it("gives a participant every matchday with its competition, the bonus one last", async () => {
      const w = await world();

      const season = await w.player.season(w.leagueId);

      expect(season.matchdays).toEqual(
        w.competitions.map((c, i) => ({
          round: i + 1,
          competitionId: c.id,
          competitionName: c.name,
          bonus: i === 2,
        })),
      );
    });

    it("gives the head-to-heads: each player at home once, none on the bonus matchday", async () => {
      const w = await world();

      const { fixtures } = await w.player.season(w.leagueId);

      expect(fixtures.map((f) => f.round).sort()).toEqual([1, 2]);
      const [one, two] = [...fixtures].sort((a, b) => a.round - b.round);
      expect([one!.home, one!.away].sort()).toEqual([w.firstId, w.secondId].sort());
      expect([two!.home, two!.away]).toEqual([one!.away, one!.home]);
    });

    it("gives the Manager scores of the league", async () => {
      const w = await world();

      const { scores } = await w.player.season(w.leagueId);

      expect([...scores].sort((a, b) => b.total - a.total)).toEqual([
        { competitionId: w.competitions[0]!.id, userId: w.firstId, total: 900 },
        { competitionId: w.competitions[0]!.id, userId: w.secondId, total: 700 },
      ]);
    });

    it("shows nothing of the league to a player outside it", async () => {
      const w = await world();

      expect(await w.outsider.season(w.leagueId)).toEqual({
        matchdays: [],
        fixtures: [],
        scores: [],
      });
    });
  });
}
