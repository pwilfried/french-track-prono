import { describe, expect, it } from "vitest";

import type { ConsensusRepository } from "@/application/consensus";
import { UseCaseError } from "@/application/errors";

/**
 * Two events of their own: `openEventId` still open and `lockedEventId` locked, each predicted by
 * Anna (a b c), Bob (b a c) and Cleo (a b c). `bob` reads as Bob, who shares `leagueId` with Anna;
 * `otherLeagueId` is a league Bob is not a member of.
 */
export type ConsensusWorld = {
  athleteIds: string[];
  openEventId: string;
  lockedEventId: string;
  leagueId: string;
  otherLeagueId: string;
  bob: ConsensusRepository;
};

/** Contract of the ConsensusRepository port, run against the in-memory fake AND Supabase. */
export function consensusRepositoryContract(name: string, world: () => Promise<ConsensusWorld>) {
  describe(`ConsensusRepository contract: ${name}`, () => {
    it("refuses the consensus of an event that is not locked", async () => {
      const w = await world();

      await expect(w.bob.podiums(w.openEventId)).rejects.toEqual(
        new UseCaseError("EVENT_NOT_LOCKED"),
      );
      await expect(w.bob.podiums(w.openEventId, w.leagueId)).rejects.toEqual(
        new UseCaseError("EVENT_NOT_LOCKED"),
      );
    });

    it("gives every podium of a locked event, mine marked", async () => {
      const w = await world();
      const [a, b, c] = w.athleteIds as [string, string, string];

      const podiums = await w.bob.podiums(w.lockedEventId);

      expect(podiums).toHaveLength(3);
      expect(podiums.filter((p) => p.mine)).toEqual([
        { podium: { first: b, second: a, third: c }, mine: true },
      ]);
      expect(podiums.filter((p) => !p.mine).map((p) => p.podium)).toEqual([
        { first: a, second: b, third: c },
        { first: a, second: b, third: c },
      ]);
    });

    it("gives only the podiums of a league's members", async () => {
      const w = await world();

      const podiums = await w.bob.podiums(w.lockedEventId, w.leagueId);

      expect(podiums).toHaveLength(2);
    });

    it("refuses a league the player is not a member of", async () => {
      const w = await world();

      await expect(w.bob.podiums(w.lockedEventId, w.otherLeagueId)).rejects.toEqual(
        new UseCaseError("LEAGUE_NOT_FOUND"),
      );
    });
  });
}
