import { describe, expect, it } from "vitest";

import type { TrophyRepository } from "@/application/trophies";
import type { Trophy } from "@/domain/trophies";

/**
 * A season with one predictions league (`leagueId`, `leagueName`) of `player` and `mate`, whose
 * only competition ends in `season`; `outsider` is in no league with them; `admin` is an admin.
 */
export type TrophyWorld = {
  season: number;
  playerId: string;
  playerPseudo: string;
  mateId: string;
  leagueId: string;
  leagueName: string;
  admin: TrophyRepository;
  player: TrophyRepository;
  mate: TrophyRepository;
  outsider: TrophyRepository;
};

/** Contract of the TrophyRepository port, run against the in-memory fake AND Supabase. */
export function trophyRepositoryContract(name: string, world: () => Promise<TrophyWorld>) {
  describe(`TrophyRepository contract: ${name}`, () => {
    const gold = (w: TrophyWorld): Trophy => ({
      userId: w.playerId,
      season: w.season,
      kind: "league",
      metal: "gold",
      leagueId: w.leagueId,
      leagueName: w.leagueName,
      animal: "cheetah",
    });
    const chrono = (w: TrophyWorld): Trophy => ({
      ...gold(w),
      kind: "chrono",
      metal: null,
      animal: null,
    });

    it("gives the admin the leagues whose last competition ends in the season", async () => {
      const w = await world();

      const facts = await w.admin.seasonFacts(w.season);

      const league = facts.leagues.find((l) => l.id === w.leagueId);
      expect(league).toMatchObject({ name: w.leagueName, families: [] });
      expect(league!.members.map((m) => m.userId).sort()).toEqual([w.playerId, w.mateId].sort());
      expect(league!.competitions).toHaveLength(1);
      expect(facts.competitions.map((c) => c.slug)).toContain(league!.competitions[0]!.slug);
    });

    it("replaces the trophies of a season, never twice the same", async () => {
      const w = await world();
      await w.admin.replaceSeason(w.season, [chrono(w)]);

      await w.admin.replaceSeason(w.season, [gold(w), gold(w)]);

      expect(await w.player.ofPlayer(w.playerId)).toEqual([gold(w)]);
    });

    it("lets the players of a league read each other's trophies, no one else", async () => {
      const w = await world();
      await w.admin.replaceSeason(w.season, [gold(w)]);

      expect(await w.mate.ofPlayer(w.playerId)).toEqual([gold(w)]);
      expect(await w.outsider.ofPlayer(w.playerId)).toEqual([]);
    });

    it("sets the FrenchTrack account by its pseudo, whatever the case, and clears it", async () => {
      const w = await world();

      expect(await w.admin.setWitness(w.playerPseudo.toUpperCase())).toBe("saved");
      expect(await w.admin.witness()).toBe(w.playerPseudo);
      expect((await w.admin.seasonFacts(w.season)).witnessId).toBe(w.playerId);
      expect(await w.admin.setWitness("Personne Inconnue")).toBe("unknown");
      expect(await w.admin.witness()).toBe(w.playerPseudo);
      expect(await w.admin.setWitness("")).toBe("cleared");
      expect(await w.admin.witness()).toBeNull();
    });

    it("refuses a player who is not an admin", async () => {
      const w = await world();

      await expect(w.player.seasonFacts(w.season)).rejects.toMatchObject({ code: "NOT_ADMIN" });
      await expect(w.player.replaceSeason(w.season, [gold(w)])).rejects.toMatchObject({
        code: "NOT_ADMIN",
      });
      await expect(w.player.setWitness(w.playerPseudo)).rejects.toMatchObject({
        code: "NOT_ADMIN",
      });
      expect(await w.player.ofPlayer(w.playerId)).toEqual([]);
    });
  });
}
