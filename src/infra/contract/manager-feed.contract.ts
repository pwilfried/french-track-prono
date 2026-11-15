import { describe, expect, it } from "vitest";

import type { ManagerFeedRepository } from "@/application/manager-feed";

/**
 * A Manager league of two, `home` and `away`: at the close of round 1, `home` won the athlete
 * `athlete` for `price` (the bid of `away` lost); matchday 1 is scored, `home` 700, `away` 900;
 * `home` holds the badge foudre in silver, told in the league. `member` reads as `away`,
 * `outsider` as a player outside the league.
 */
export type ManagerFeedWorld = {
  member: ManagerFeedRepository;
  outsider: ManagerFeedRepository;
  leagueId: string;
  homePseudo: string;
  awayPseudo: string;
  athlete: string;
  price: number;
};

/** Contract of the ManagerFeedRepository port (#875), run against the fake AND Supabase. */
export function managerFeedContract(name: string, world: () => Promise<ManagerFeedWorld>) {
  describe(`ManagerFeedRepository contract: ${name}`, () => {
    it("tells a participant the athletes won at the reveal, not the bids lost", async () => {
      const w = await world();
      const { wins } = await w.member.facts(w.leagueId);
      expect(wins).toHaveLength(1);
      expect(wins[0]).toMatchObject({
        round: 1,
        athlete: w.athlete,
        price: w.price,
        pseudo: w.homePseudo,
      });
    });

    it("tells a participant the duel of a scored matchday, with both scores", async () => {
      const w = await world();
      const { duels } = await w.member.facts(w.leagueId);
      expect(duels).toHaveLength(1);
      expect(duels[0]).toMatchObject({
        round: 1,
        home: { pseudo: w.homePseudo, score: 700 },
        away: { pseudo: w.awayPseudo, score: 900 },
      });
    });

    it("tells a participant the badges published in the league", async () => {
      const w = await world();
      const { published } = await w.member.facts(w.leagueId);
      expect(published).toMatchObject([
        { kind: "badge", pseudo: w.homePseudo, badge: "foudre", level: "silver" },
      ]);
    });

    it("tells someone outside the league nothing", async () => {
      const w = await world();
      expect(await w.outsider.facts(w.leagueId)).toEqual({ wins: [], duels: [], published: [] });
    });
  });
}
