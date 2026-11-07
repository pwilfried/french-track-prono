import { describe, expect, it } from "vitest";

import type { RankingLine, RankingRepository } from "@/application/rankings";

/** A competition of its own with two score lines: Ana 24 (perfect, joker), Bob 3 (winner). */
export type RankingWorld = {
  competitionSlug: string;
  expected: RankingLine[];
  reader: RankingRepository;
};

/** Contract of the RankingRepository port, run against the in-memory fake AND Supabase. */
export function rankingRepositoryContract(name: string, world: () => Promise<RankingWorld>) {
  const byUser = (lines: RankingLine[]) =>
    [...lines].sort((a, b) => a.userId.localeCompare(b.userId));

  describe(`RankingRepository contract: ${name}`, () => {
    it("reads every score line of a competition with the pseudos", async () => {
      const w = await world();

      expect(byUser(await w.reader.competitionLines(w.competitionSlug))).toEqual(
        byUser(w.expected),
      );
    });

    it("reads nothing for another competition", async () => {
      const w = await world();

      expect(await w.reader.competitionLines(`other-${crypto.randomUUID()}`)).toEqual([]);
    });
  });
}
