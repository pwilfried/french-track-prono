import { describe, expect, it } from "vitest";

import type { ManagerJokerRepository } from "@/application/manager-jokers";

/**
 * A Manager league of its own with Anna and Bob, every Manager joker. Anna's team: `annaTeam`
 * (three athletes of the same family), Bob's: `bobTeam`. Matchdays: `open` (Anna at home),
 * `away` (Anna away), `bonus` (no head-to-head), all open; `locked` (Anna at home), whose lineup
 * locked with Anna's first athlete only on the sheet and « Coaching » chosen before the lock.
 * Cleo is not in the league.
 */
export type ManagerJokerContractWorld = {
  leagueId: string;
  annaId: string;
  bobId: string;
  annaTeam: string[];
  bobTeam: string[];
  open: string;
  away: string;
  bonus: string;
  locked: string;
  anna: ManagerJokerRepository;
  bob: ManagerJokerRepository;
  cleo: ManagerJokerRepository;
};

/** Contract of the ManagerJokerRepository port (#1091), run against the in-memory fake AND Supabase. */
export function managerJokerContract(
  name: string,
  world: () => Promise<ManagerJokerContractWorld>,
) {
  describe(`ManagerJokerRepository contract: ${name}`, () => {
    it("reads the jokers the league received, none for a player outside it", async () => {
      const w = await world();
      expect((await w.anna.leagueJokers(w.leagueId)).sort()).toEqual([
        "captain",
        "coaching",
        "extended_bench",
        "false_start",
        "home_advantage",
      ]);
      expect(await w.cleo.leagueJokers(w.leagueId)).toEqual([]);
    });

    it("tells the player's head-to-head of the matchday, with the opponent's team", async () => {
      const w = await world();
      expect(await w.anna.duel(w.leagueId, w.open)).toEqual({
        home: true,
        opponentId: w.bobId,
        opponentTeam: [{ athleteId: w.bobTeam[0], name: expect.any(String) }],
      });
      expect(await w.anna.duel(w.leagueId, w.away)).toMatchObject({ home: false });
      expect(await w.anna.duel(w.leagueId, w.bonus)).toBeNull();
      expect(await w.cleo.duel(w.leagueId, w.open)).toBe("not_member");
    });

    it("plays a joker once in the season, one per head-to-head, hidden from the opponent until the lock", async () => {
      const w = await world();
      const [first] = w.annaTeam;

      expect(await w.anna.play(w.leagueId, w.open, "captain", first!)).toBe("done");
      expect(await w.anna.play(w.leagueId, w.away, "captain", first!)).toBe("not_available");
      expect(await w.anna.play(w.leagueId, w.open, "false_start", w.bobTeam[0]!)).toBe("done");

      const mine = (await w.anna.plays(w.leagueId)).filter((p) => p.competitionId === w.open);
      expect(mine).toEqual([
        expect.objectContaining({
          userId: w.annaId,
          kind: "false_start",
          athleteId: w.bobTeam[0],
          coached: false,
        }),
      ]);
      expect((await w.bob.plays(w.leagueId)).filter((p) => p.competitionId === w.open)).toEqual([]);
    });

    it("refuses a joker on a bonus matchday, the home advantage away, and a target that does not fit", async () => {
      const w = await world();
      expect(await w.anna.play(w.leagueId, w.bonus, "home_advantage", null)).toBe("no_duel");
      expect(await w.anna.play(w.leagueId, w.away, "home_advantage", null)).toBe("away");
      expect(await w.anna.play(w.leagueId, w.open, "false_start", w.annaTeam[1]!)).toBe(
        "bad_target",
      );
      expect(await w.anna.play(w.leagueId, w.open, "captain", w.bobTeam[0]!)).toBe("bad_target");
    });

    it("takes back the joker of the matchday before the lock, never after", async () => {
      const w = await world();
      await w.anna.play(w.leagueId, w.open, "home_advantage", null);

      expect(await w.anna.remove(w.leagueId, w.open)).toBe("done");
      expect((await w.anna.plays(w.leagueId)).filter((p) => p.competitionId === w.open)).toEqual(
        [],
      );
      expect(await w.anna.remove(w.leagueId, w.locked)).toBe("locked");
      expect(await w.anna.play(w.leagueId, w.locked, "captain", w.annaTeam[0]!)).toBe("locked");
    });

    it("uses the coaching once after the lock; the opponent sees it", async () => {
      const w = await world();
      const [starter, coached, other] = w.annaTeam;

      expect(await w.anna.coach(w.leagueId, w.open, starter!, coached!)).toBe("no_coaching");
      expect(await w.anna.coach(w.leagueId, w.locked, starter!, coached!)).toBe("done");
      expect(await w.anna.coach(w.leagueId, w.locked, coached!, other!)).toBe("no_coaching");

      const seen = (await w.bob.plays(w.leagueId)).filter((p) => p.competitionId === w.locked);
      expect(seen).toEqual([
        expect.objectContaining({
          userId: w.annaId,
          kind: "coaching",
          athleteId: coached,
          replacedId: starter,
          coached: true,
        }),
      ]);
    });

    it("lets no player outside the league play", async () => {
      const w = await world();
      expect(await w.cleo.play(w.leagueId, w.open, "home_advantage", null)).toBe("not_member");
      expect(await w.cleo.plays(w.leagueId)).toEqual([]);
    });
  });
}
