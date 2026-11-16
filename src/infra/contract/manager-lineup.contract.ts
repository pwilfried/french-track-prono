import { describe, expect, it } from "vitest";

import type { ManagerLineupRepository } from "@/application/manager-lineup";
import type { MatchSheet } from "@/domain/manager-lineup";

/** A match sheet of these starters, with their first discipline, and no substitute. */
const starters = (ids: string[]): MatchSheet => ({
  starters: ids.map((athleteId) => ({ athleteId })),
  bench: [],
});

/**
 * A league whose mercato is closed, with one place per family (sprint, distance, jumps, throws). The first
 * participant's team: a sprinter and a middle-distance runner entered in the `open` competition, a
 * thrower entered nowhere; the sprinter runs the 100 m only. No bench. The `locked` competition has started. `elsewhere` is a competition the
 * league does not play; `mercatoLeagueId` a league of the first participant still in its mercato.
 */
export type ManagerLineupWorld = {
  leagueId: string;
  mercatoLeagueId: string;
  first: ManagerLineupRepository;
  second: ManagerLineupRepository;
  outsider: ManagerLineupRepository;
  open: { competitionId: string; slug: string };
  locked: { competitionId: string; slug: string };
  elsewhere: string;
  sprinter: string;
  runner: string;
  thrower: string;
  restore: () => Promise<void>;
};

/** Contract of the ManagerLineupRepository port, run against the in-memory fake AND Supabase. */
export function managerLineupContract(name: string, world: () => Promise<ManagerLineupWorld>) {
  describe(`ManagerLineupRepository contract: ${name}`, () => {
    it("validates a lineup that fills every place, keeps the last one and shows it to its player only", async () => {
      const w = await world();
      try {
        const before = await w.first.mine(w.leagueId);
        if (before === "not_member") throw new Error("the participant reads their lineups");
        const open = before.find((c) => c.slug === w.open.slug)!;
        expect(open.competitionId).toBe(w.open.competitionId);
        expect([...open.entered].sort()).toEqual([w.sprinter, w.runner].sort());
        expect(open.lineup).toBeNull();
        expect(Date.parse(open.lockAt)).toBeGreaterThan(Date.now());
        const locked = before.find((c) => c.slug === w.locked.slug)!;
        expect(Date.parse(locked.lockAt)).toBeLessThanOrEqual(Date.now());

        expect(
          await w.first.save(w.leagueId, w.open.competitionId, starters([w.sprinter, w.runner])),
        ).toBe("saved");
        expect(
          await w.first.save(w.leagueId, w.open.competitionId, starters([w.runner, w.sprinter])),
        ).toBe("saved");
        const after = await w.first.mine(w.leagueId);
        if (after === "not_member") throw new Error("the participant reads their lineups");
        expect(after.find((c) => c.slug === w.open.slug)!.lineup).toEqual([w.runner, w.sprinter]);

        const theirs = await w.second.mine(w.leagueId);
        if (theirs === "not_member") throw new Error("the second participant reads their lineups");
        expect(theirs.find((c) => c.slug === w.open.slug)!.lineup).toBeNull();
      } finally {
        await w.restore();
      }
    });

    it("refuses a lineup that leaves a place empty, repeats an athlete or holds an absent one", async () => {
      const w = await world();
      try {
        const save = (ids: string[]) =>
          w.first.save(w.leagueId, w.open.competitionId, starters(ids));
        expect(await save([w.sprinter])).toBe("invalid");
        expect(await save([w.sprinter, w.sprinter])).toBe("invalid");
        expect(await save([w.sprinter, w.thrower])).toBe("invalid");
        expect(await save([w.sprinter, w.runner, w.thrower])).toBe("invalid");
      } finally {
        await w.restore();
      }
    });

    it("refuses a substitute beyond the bench and a discipline the athlete is not entered in", async () => {
      const w = await world();
      try {
        const save = (sheet: MatchSheet) => w.first.save(w.leagueId, w.open.competitionId, sheet);
        expect(
          await save({ starters: [{ athleteId: w.sprinter }], bench: [{ athleteId: w.runner }] }),
        ).toBe("bench_full");
        expect(
          await save({
            starters: [
              { athleteId: w.sprinter, discipline: "Lancer du poids" },
              { athleteId: w.runner },
            ],
            bench: [],
          }),
        ).toBe("discipline_not_entered");
        expect(
          await save({
            starters: [{ athleteId: w.sprinter, discipline: "100 m" }, { athleteId: w.runner }],
            bench: [],
          }),
        ).toBe("saved");
      } finally {
        await w.restore();
      }
    });

    it("reads back the saved sheet, with the discipline that counts, and each athlete's disciplines", async () => {
      const w = await world();
      try {
        const empty = await w.first.sheet(w.leagueId, w.open.competitionId);
        if (typeof empty === "string") throw new Error("the participant reads their sheet");
        expect(empty.sheet).toBeNull();
        expect(empty.disciplines[w.sprinter]!.map((d) => d.name)).toEqual(["100 m"]);
        expect(empty.disciplines[w.sprinter]![0]).toEqual({
          name: "100 m",
          family: "sprint",
          unit: "time",
        });

        await w.first.save(w.leagueId, w.open.competitionId, starters([w.sprinter, w.runner]));
        const saved = await w.first.sheet(w.leagueId, w.open.competitionId);
        if (typeof saved === "string") throw new Error("the participant reads their sheet");
        expect(saved.sheet).toEqual({
          starters: [
            { athleteId: w.sprinter, discipline: "100 m", substituteId: null, threshold: null },
            {
              athleteId: w.runner,
              // Their first discipline, whichever the start lists give.
              discipline: empty.disciplines[w.runner]![0]!.name,
              substituteId: null,
              threshold: null,
            },
          ],
          bench: [],
        });

        const theirs = await w.second.sheet(w.leagueId, w.open.competitionId);
        if (typeof theirs === "string") throw new Error("the second participant reads theirs");
        expect(theirs.sheet).toBeNull();
        expect(await w.outsider.sheet(w.leagueId, w.open.competitionId)).toBe("not_member");
        expect(await w.first.sheet(w.leagueId, w.elsewhere)).toBe("not_eligible");
      } finally {
        await w.restore();
      }
    });

    it("refuses a lineup after the lock, outside the league or before the end of the mercato", async () => {
      const w = await world();
      try {
        const ids = starters([w.sprinter, w.runner]);
        expect(await w.first.save(w.leagueId, w.locked.competitionId, ids)).toBe("locked");
        expect(await w.first.save(w.leagueId, w.elsewhere, ids)).toBe("not_eligible");
        expect(await w.first.save(w.mercatoLeagueId, w.open.competitionId, ids)).toBe(
          "mercato_open",
        );
        expect(await w.outsider.save(w.leagueId, w.open.competitionId, ids)).toBe("not_member");
        expect(await w.outsider.mine(w.leagueId)).toBe("not_member");
      } finally {
        await w.restore();
      }
    });
  });
}
