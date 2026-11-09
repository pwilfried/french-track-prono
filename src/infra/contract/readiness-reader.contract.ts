import { describe, expect, it } from "vitest";

import type { ReadinessReader } from "@/application/competition-readiness";

export type ReadinessWorld = {
  reader: ReadinessReader;
  /** A competition of its own with two events; returns their ids. */
  competition: { slug: string; events: [string, string] };
  addStartList(eventId: string): Promise<void>;
  addOdds(eventId: string): Promise<void>;
};

/** Contract of the ReadinessReader port (#379), run against the fake AND Supabase. */
export function readinessContract(name: string, world: () => Promise<ReadinessWorld>) {
  describe(`ReadinessReader contract: ${name}`, () => {
    it("tells which events have a start list and which have odds", async () => {
      const w = await world();
      const [first, second] = w.competition.events;
      expect(await w.reader.readiness(w.competition.slug)).toEqual({
        withStartList: [],
        withOdds: [],
      });

      await w.addStartList(first);
      await w.addStartList(second);
      await w.addOdds(first);
      const ready = await w.reader.readiness(w.competition.slug);
      expect([...ready.withStartList].sort()).toEqual([first, second].sort());
      expect(ready.withOdds).toEqual([first]);
    });

    it("gives nothing for an unknown competition", async () => {
      const w = await world();
      expect(await w.reader.readiness("no-such-competition")).toEqual({
        withStartList: [],
        withOdds: [],
      });
    });
  });
}
