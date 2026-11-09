import { describe, expect, it } from "vitest";

import type { DisciplineRepository } from "@/application/disciplines";

/** A discipline this test may change (reset after), an admin session and a player session. */
export type DisciplineWorld = {
  admin: DisciplineRepository;
  player: DisciplineRepository;
  /** Puts the tolerance of the 100 m back as it was. */
  restore: () => Promise<void>;
};

/** Contract of the DisciplineRepository port, run against the in-memory fake AND Supabase. */
export function disciplineRepositoryContract(name: string, world: () => Promise<DisciplineWorld>) {
  describe(`DisciplineRepository contract: ${name}`, () => {
    it("lists the 100 m as a race on time with a positive tolerance, and the high jump the other way", async () => {
      const w = await world();
      const list = await w.player.list();

      expect(list.find((d) => d.name === "100 m")).toMatchObject({
        unit: "time",
        lowerIsBetter: true,
      });
      expect(list.find((d) => d.name === "Saut en hauteur")).toMatchObject({
        unit: "distance",
        lowerIsBetter: false,
      });
      expect(list.every((d) => d.tolerance > 0)).toBe(true);
    });

    it("lets an admin change a tolerance, refuses a player and an unknown discipline", async () => {
      const w = await world();
      try {
        expect(await w.player.setTolerance("100 m", 1)).toBe("not_admin");
        expect(await w.admin.setTolerance("Course en sac", 1)).toBe("unknown");
        expect(await w.admin.setTolerance("100 m", 0.07)).toBe("saved");

        expect((await w.player.list()).find((d) => d.name === "100 m")?.tolerance).toBe(0.07);
      } finally {
        await w.restore();
      }
    });

    it("lets an admin add a discipline once, and refuses a player", async () => {
      const w = await world();
      const name = `Test ${crypto.randomUUID().slice(0, 8)}`;
      const discipline = {
        name,
        family: "hurdles" as const,
        unit: "time" as const,
        lowerIsBetter: true,
        tolerance: 0.05,
      };
      expect(await w.player.create(discipline)).toBe("not_admin");
      expect(await w.admin.create(discipline)).toBe("created");
      expect(await w.admin.create({ ...discipline, name: name.toUpperCase() })).toBe("exists");
      expect((await w.player.list()).find((d) => d.name === name)).toMatchObject(discipline);
    });
  });
}
