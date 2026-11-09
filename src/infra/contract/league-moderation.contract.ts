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
      const listed = await w.admin.list();
      expect(listed !== "not_admin" && listed.find((l) => l.id === league.id)).toMatchObject({
        name: league.name,
        isPublic: true,
        reportCount: 1,
        memberCount: 1,
      });

      expect(await w.admin.rename(league.id, "Les Gazelles")).toBe("done");
      expect((await w.creator.listMine()).find((l) => l.id === league.id)?.name).toBe(
        "Les Gazelles",
      );
      const after = await w.admin.list();
      expect(after !== "not_admin" && after.find((l) => l.id === league.id)?.reportCount).toBe(0);
    });

    it("dismisses the reports of a league, which stays as it is", async () => {
      const w = await world();
      const league = await w.creator.create(
        `Innocente ${crypto.randomUUID().slice(0, 6)}`,
        [],
        true,
      );
      await w.reporter.report(league.id);

      expect(await w.admin.dismissReports(league.id)).toBe("done");
      const listed = await w.admin.list();
      expect(listed !== "not_admin" && listed.find((l) => l.id === league.id)).toMatchObject({
        name: league.name,
        reportCount: 0,
      });
    });

    it("reads the members, removes one, never the owner", async () => {
      const w = await world();
      const league = await w.creator.create(`Club ${crypto.randomUUID().slice(0, 6)}`, [], true);
      expect((await w.reporter.joinPublic(league.id)).outcome).toBe("joined");

      const members = await w.admin.members(league.id);
      expect(members !== "not_admin" && members.map((m) => m.isOwner).sort()).toEqual([
        false,
        true,
      ]);
      const owner = members !== "not_admin" ? members.find((m) => m.isOwner)! : null;
      const other = members !== "not_admin" ? members.find((m) => !m.isOwner)! : null;
      expect(other && other.rank >= 1 && other.points).toBe(0);

      expect(await w.admin.removeMember(league.id, owner!.userId)).toBe("owner");
      expect(await w.admin.removeMember(league.id, other!.userId)).toBe("done");
      expect(await w.admin.removeMember(league.id, other!.userId)).toBe("unknown");
      const left = await w.admin.members(league.id);
      expect(left !== "not_admin" && left.length).toBe(1);
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

      expect(await w.notAdmin.list()).toBe("not_admin");
      expect(await w.notAdmin.members(league.id)).toBe("not_admin");
      expect(await w.notAdmin.dismissReports(league.id)).toBe("not_admin");
      expect(await w.notAdmin.rename(league.id, "Autre")).toBe("not_admin");
      expect(await w.notAdmin.remove(league.id)).toBe("not_admin");
    });
  });
}
