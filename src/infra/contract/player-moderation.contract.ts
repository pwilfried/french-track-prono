import { describe, expect, it } from "vitest";

import type { PlayerModerationRepository } from "@/application/player-moderation";

export type PlayerModerationWorld = {
  admin: PlayerModerationRepository;
  notAdmin: PlayerModerationRepository;
  /** A new player with this pseudo; returns their id. */
  newPlayer(pseudo: string): Promise<string>;
  /** The id of an admin. */
  adminId: string;
};

const tag = () =>
  `Zm${crypto
    .randomUUID()
    .slice(0, 6)
    .replace(/[^a-z]/g, "x")}`;

/** Contract of the PlayerModerationRepository port (#343), run against the fake AND Supabase. */
export function playerModerationContract(
  name: string,
  world: () => Promise<PlayerModerationWorld>,
) {
  describe(`PlayerModerationRepository contract: ${name}`, () => {
    it("finds a player by part of the pseudo, accents and case ignored", async () => {
      const w = await world();
      const t = tag();
      const id = await w.newPlayer(`Éloïse ${t}`);

      const found = await w.admin.search(`eloise ${t.toUpperCase()}`);
      expect(found !== "not_admin" && found.map((p) => p.id)).toEqual([id]);
    });

    it("blocks, then unblocks a player", async () => {
      const w = await world();
      const t = tag();
      const id = await w.newPlayer(`Bloqué ${t}`);

      expect(await w.admin.setBlocked(id, true)).toBe("done");
      const blocked = await w.admin.search(t);
      expect(blocked !== "not_admin" && blocked[0]).toMatchObject({ id, blocked: true });

      expect(await w.admin.setBlocked(id, false)).toBe("done");
      const back = await w.admin.search(t);
      expect(back !== "not_admin" && back[0]).toMatchObject({ id, blocked: false });
    });

    it("deletes a player", async () => {
      const w = await world();
      const t = tag();
      const id = await w.newPlayer(`Parti ${t}`);

      expect(await w.admin.remove(id)).toBe("done");
      expect(await w.admin.search(t)).toEqual([]);
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
      expect(await w.notAdmin.search("a")).toBe("not_admin");
      expect(await w.notAdmin.setBlocked(id, true)).toBe("not_admin");
      expect(await w.notAdmin.remove(id)).toBe("not_admin");
    });
  });
}
