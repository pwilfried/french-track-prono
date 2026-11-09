import { describe, expect, it } from "vitest";

import type { PlayerModerationRepository } from "@/application/player-moderation";

export type PlayerModerationWorld = {
  admin: PlayerModerationRepository;
  notAdmin: PlayerModerationRepository;
  /** A new player with this pseudo; returns their id. */
  newPlayer(pseudo: string): Promise<string>;
  /** The id of an admin. */
  adminId: string;
  /** The player is alone in a new league with this name. */
  joinLeague(playerId: string, name: string): Promise<void>;
};

const byId = async (repository: PlayerModerationRepository, id: string) => {
  const list = await repository.list();
  return list === "not_admin" ? "not_admin" : (list.find((p) => p.id === id) ?? null);
};

// Letters only, 16 per character: a digit becomes g to p (the old "x" for every digit made
// "Zmxxxxxx" common enough for two tests of one run to collide).
const tag = () =>
  `Zm${crypto
    .randomUUID()
    .slice(0, 6)
    .replace(/[0-9]/g, (d) => String.fromCharCode(103 + Number(d)))}`;

/** Contract of the PlayerModerationRepository port (#343), run against the fake AND Supabase. */
export function playerModerationContract(
  name: string,
  world: () => Promise<PlayerModerationWorld>,
) {
  describe(`PlayerModerationRepository contract: ${name}`, () => {
    it("lists a new player with their figures, never their e-mail", async () => {
      const w = await world();
      const t = tag();
      const id = await w.newPlayer(`Éloïse ${t}`);

      const found = await byId(w.admin, id);
      expect(found).toMatchObject({
        pseudo: `Éloïse ${t}`,
        blocked: false,
        isAdmin: false,
        club: null,
        points: 0,
        predictions: 0,
        leagues: 0,
        reports: 0,
      });
      expect(found && found !== "not_admin" && Date.parse(found.lastActiveAt) > 0).toBe(true);
      expect(JSON.stringify(found)).not.toContain("@");
    });

    it("gives the leagues of a player with their rank", async () => {
      const w = await world();
      const t = tag();
      const id = await w.newPlayer(`Ligueur ${t}`);
      expect(await w.admin.leaguesOf(id)).toEqual([]);

      await w.joinLeague(id, `Ligue ${t}`);
      const leagues = await w.admin.leaguesOf(id);
      expect(
        leagues !== "not_admin" &&
          leagues.map(({ name, memberCount, rank }) => ({ name, memberCount, rank })),
      ).toEqual([{ name: `Ligue ${t}`, memberCount: 1, rank: 1 }]);
      expect((await byId(w.admin, id)) as { leagues: number }).toMatchObject({ leagues: 1 });
    });

    it("blocks, then unblocks a player", async () => {
      const w = await world();
      const t = tag();
      const id = await w.newPlayer(`Bloqué ${t}`);

      expect(await w.admin.setBlocked(id, true)).toBe("done");
      expect(await byId(w.admin, id)).toMatchObject({ id, blocked: true });

      expect(await w.admin.setBlocked(id, false)).toBe("done");
      expect(await byId(w.admin, id)).toMatchObject({ id, blocked: false });
    });

    it("deletes a player", async () => {
      const w = await world();
      const t = tag();
      const id = await w.newPlayer(`Parti ${t}`);

      expect(await w.admin.remove(id)).toBe("done");
      expect(await byId(w.admin, id)).toBeNull();
      expect(await w.admin.remove(id)).toBe("unknown");
    });

    it("never blocks nor deletes an admin", async () => {
      const w = await world();
      expect(await w.admin.setBlocked(w.adminId, true)).toBe("unknown");
      expect(await w.admin.remove(w.adminId)).toBe("unknown");
    });

    it("refuses a player who is not admin", async () => {
      const w = await world();
      const id = await w.newPlayer(`Cible ${tag()}`);
      expect(await w.notAdmin.list()).toBe("not_admin");
      expect(await w.notAdmin.leaguesOf(id)).toBe("not_admin");
      expect(await w.notAdmin.setBlocked(id, true)).toBe("not_admin");
      expect(await w.notAdmin.remove(id)).toBe("not_admin");
    });
  });
}
