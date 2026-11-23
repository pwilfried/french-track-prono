import { describe, expect, it } from "vitest";

import type { TrophyAnnouncements, TrophyRepository } from "@/application/trophies";
import type { Trophy } from "@/domain/trophies";

const NONE: TrophyAnnouncements = { moments: [], news: [] };

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
      animal: "guepard",
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
      await w.admin.replaceSeason(w.season, [chrono(w)], NONE);

      await w.admin.replaceSeason(w.season, [gold(w), gold(w)], NONE);

      expect(await w.player.ofPlayer(w.playerId)).toEqual([gold(w)]);
    });

    it("gives the admin every trophy of the season, a kept one in its new metal", async () => {
      const w = await world();
      await w.admin.replaceSeason(w.season, [gold(w), chrono(w)], NONE);

      await w.admin.replaceSeason(w.season, [{ ...gold(w), metal: "silver" }], NONE);

      expect(await w.admin.seasonTrophies(w.season)).toEqual([{ ...gold(w), metal: "silver" }]);
      await expect(w.player.seasonTrophies(w.season)).rejects.toMatchObject({ code: "NOT_ADMIN" });
    });

    it("publishes the announcements of a draw, and takes the same ones again without error", async () => {
      const w = await world();
      const won = { ...chrono(w), points: 84 };
      const announcements: TrophyAnnouncements = {
        moments: [
          {
            feed: "league",
            leagueId: w.leagueId,
            key: `trophy:${w.season}:chrono:${w.leagueId}:${w.playerId}`,
            userId: w.playerId,
            trophy: "chrono",
            season: w.season,
            points: 84,
          },
        ],
        news: [won],
      };

      await w.admin.replaceSeason(w.season, [won], announcements);
      await w.admin.replaceSeason(w.season, [won], announcements);

      // The points are told, not kept with the trophy.
      expect(await w.player.ofPlayer(w.playerId)).toEqual([chrono(w)]);
    });

    it("lets the players of a league read each other's trophies, no one else", async () => {
      const w = await world();
      await w.admin.replaceSeason(w.season, [gold(w)], NONE);

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
      await expect(w.player.replaceSeason(w.season, [gold(w)], NONE)).rejects.toMatchObject({
        code: "NOT_ADMIN",
      });
      await expect(w.player.setWitness(w.playerPseudo)).rejects.toMatchObject({
        code: "NOT_ADMIN",
      });
      expect(await w.player.ofPlayer(w.playerId)).toEqual([]);
    });
  });
}
