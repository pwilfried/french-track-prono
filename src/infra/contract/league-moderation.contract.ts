import { describe, expect, it } from "vitest";

import type { LeagueModerationRepository } from "@/application/league-moderation";
import type { LeagueRepository } from "@/application/leagues";

export type ModerationWorld = {
  /** Two players, the first creates public leagues. */
  creator: LeagueRepository;
  reporter: LeagueRepository;
  admin: LeagueModerationRepository;
  /** A player who is not admin, trying to moderate. */
  notAdmin: LeagueModerationRepository;
};

/** Contract of the LeagueModerationRepository port (#321), run against the fake AND Supabase. */
export function leagueModerationContract(name: string, world: () => Promise<ModerationWorld>) {
  describe(`LeagueModerationRepository contract: ${name}`, () => {
    it("lists a reported public league once per player, then renames it and clears its reports", async () => {
      const w = await world();
      const league = await w.creator.create(
        `Douteuse ${crypto.randomUUID().slice(0, 6)}`,
        [],
        true,
      );

      expect(await w.reporter.report(league.id)).toBe("reported");
      expect(await w.reporter.report(league.id)).toBe("reported");
      const listed = await w.admin.listReported();
      expect(listed !== "not_admin" && listed.find((l) => l.id === league.id)).toMatchObject({
        name: league.name,
        reportCount: 1,
        memberCount: 1,
      });

      expect(await w.admin.rename(league.id, "Les Gazelles")).toBe("done");
      expect((await w.creator.listMine()).find((l) => l.id === league.id)?.name).toBe(
        "Les Gazelles",
      );
      const after = await w.admin.listReported();
      expect(after !== "not_admin" && after.some((l) => l.id === league.id)).toBe(false);
    });

    it("deletes a league", async () => {
      const w = await world();
      const league = await w.creator.create("À supprimer", [], true);
      await w.reporter.report(league.id);

      expect(await w.admin.remove(league.id)).toBe("done");

      expect((await w.creator.listMine()).some((l) => l.id === league.id)).toBe(false);
      expect(await w.admin.remove(league.id)).toBe("unknown");
    });

    it("refuses to report a private league", async () => {
      const w = await world();
      const league = await w.creator.create("Privée", [], false);

      expect(await w.reporter.report(league.id)).toBe("unknown");
    });

    it("refuses a player who is not admin", async () => {
      const w = await world();
      const league = await w.creator.create("Intouchable", [], true);

      expect(await w.notAdmin.listReported()).toBe("not_admin");
      expect(await w.notAdmin.rename(league.id, "Autre")).toBe("not_admin");
      expect(await w.notAdmin.remove(league.id)).toBe("not_admin");
    });
  });
}
