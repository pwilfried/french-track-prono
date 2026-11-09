import { describe, expect, it } from "vitest";

import type { ClubAdminRepository } from "@/application/club-admin";

export type ClubAdminWorld = {
  admin: ClubAdminRepository;
  notAdmin: ClubAdminRepository;
  /** A club a player typed, not validated yet; returns its id. */
  playerClub(name: string): Promise<string>;
  /** A player chooses this club. */
  playerOn(clubId: string): Promise<void>;
};

// Letters only, 16 per character: a digit becomes g to p (the old "x" for every digit made
// "Zcxxxxxx" common enough for two tests of one run to collide).
const tag = () =>
  `Zc${crypto
    .randomUUID()
    .slice(0, 6)
    .replace(/[0-9]/g, (d) => String.fromCharCode(103 + Number(d)))}`;

/** Contract of the ClubAdminRepository port (#366), run against the fake AND Supabase. */
export function clubAdminContract(name: string, world: () => Promise<ClubAdminWorld>) {
  describe(`ClubAdminRepository contract: ${name}`, () => {
    it("lists the clubs to validate first, then validates one", async () => {
      const w = await world();
      const t = tag();
      const id = await w.playerClub(`Foulées ${t}`);

      const pending = await w.admin.list(t, true);
      expect(pending !== "not_admin" && pending.map((c) => c.id)).toEqual([id]);
      expect(await w.admin.validate(id)).toBe("done");
      expect(await w.admin.list(t, true)).toEqual([]);
      const all = await w.admin.list(t, false);
      expect(all !== "not_admin" && all[0]).toMatchObject({ id, validated: true });
    });

    it("creates, renames and deletes a club", async () => {
      const w = await world();
      const t = tag();
      const id = await w.admin.save(null, { name: `Club ${t}`, city: "Ici", department: "75" });
      expect(typeof id === "string" && id.length > 10).toBe(true);
      if (id === "not_admin" || id === "unknown" || id === "banned") return;

      expect(await w.admin.save(id, { name: `Stade ${t}`, city: "Là", department: "13" })).toBe(id);
      const found = await w.admin.list(t, false);
      expect(found !== "not_admin" && found[0]).toMatchObject({
        id,
        name: `Stade ${t}`,
        city: "Là",
        department: "13",
        source: "admin",
        validated: true,
      });

      expect(await w.admin.remove(id)).toBe("done");
      expect(await w.admin.remove(id)).toBe("unknown");
      expect(await w.admin.list(t, false)).toEqual([]);
    });

    it("merges a duplicate into the right club with its players", async () => {
      const w = await world();
      const t = tag();
      const typed = await w.playerClub(`AC ${t}`);
      const right = await w.admin.save(null, {
        name: `Athletic Club ${t}`,
        city: "",
        department: "",
      });
      if (typeof right !== "string" || right === "not_admin") throw new Error("not created");
      await w.playerOn(typed);

      expect(await w.admin.merge(typed, typed)).toBe("same");
      expect(await w.admin.merge(typed, right)).toBe(1);
      expect(await w.admin.merge(typed, right)).toBe("unknown");
      const left = await w.admin.list(t, false, 5000);
      expect(left !== "not_admin" && left.map((c) => [c.id, c.playerCount])).toEqual([[right, 1]]);
      expect(left !== "not_admin" && Date.parse(left[0]!.createdAt) > 0).toBe(true);
      expect(await w.notAdmin.merge(right, typed)).toBe("not_admin");
    });

    it("refuses banned words and a player who is not admin", async () => {
      const w = await world();
      expect(
        await w.admin.save(null, { name: "Club Officiel FFA", city: "", department: "" }),
      ).toBe("banned");
      expect(await w.notAdmin.list("", false)).toBe("not_admin");
      expect(await w.notAdmin.save(null, { name: "Club", city: "", department: "" })).toBe(
        "not_admin",
      );
    });
  });
}
