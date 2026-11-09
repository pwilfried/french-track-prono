import { describe, expect, it } from "vitest";

import type { ClubDirectory } from "@/application/clubs";

export type ClubWorld = {
  directory: ClubDirectory;
  /** Adds imported (validated) clubs; the tag keeps them apart from other tests. */
  importClubs(clubs: { name: string; city: string; department: string }[]): Promise<void>;
  /** Adds a club a player typed, not yet validated. */
  addUnvalidated(name: string): Promise<void>;
};

/** Contract of the ClubDirectory port (#339), run against the fake AND Supabase. */
export function clubDirectoryContract(name: string, world: () => Promise<ClubWorld>) {
  describe(`ClubDirectory contract: ${name}`, () => {
    it("finds clubs by every word of the query, accents and case ignored", async () => {
      const w = await world();
      const tag = `Zq${crypto
        .randomUUID()
        .slice(0, 6)
        .replace(/[^a-z]/g, "x")}`;
      await w.importClubs([
        { name: `Athlétisme ${tag} Créteil`, city: "Créteil", department: "94" },
        { name: `Foulées ${tag}`, city: "Évry", department: "91" },
      ]);

      const both = await w.directory.search(tag.toUpperCase(), 20);
      expect(both.map((c) => c.name).sort()).toEqual(
        [`Athlétisme ${tag} Créteil`, `Foulées ${tag}`].sort(),
      );
      const one = await w.directory.search(`${tag} evry`, 20);
      expect(one).toEqual([
        expect.objectContaining({
          name: `Foulées ${tag}`,
          city: "Évry",
          department: "91",
          validated: true,
        }),
      ]);
    });

    it("keeps to the limit", async () => {
      const w = await world();
      const tag = `Zl${crypto
        .randomUUID()
        .slice(0, 6)
        .replace(/[^a-z]/g, "x")}`;
      await w.importClubs(
        Array.from({ length: 3 }, (_, i) => ({
          name: `Club ${tag} ${i}`,
          city: "",
          department: "",
        })),
      );
      expect(await w.directory.search(tag, 2)).toHaveLength(2);
    });

    it("hides a club that is not validated yet", async () => {
      const w = await world();
      const tag = `Zh${crypto
        .randomUUID()
        .slice(0, 6)
        .replace(/[^a-z]/g, "x")}`;
      await w.addUnvalidated(`Cachés ${tag}`);
      expect(await w.directory.search(tag, 20)).toEqual([]);
    });
  });
}
