import { describe, expect, it } from "vitest";

import type { AthleteAdminRepository } from "@/application/edit-athlete";

/** An athlete of its own (slug, id) that the test may change, and two sessions. */
export type AthleteAdminWorld = {
  athleteId: string;
  slug: string;
  admin: AthleteAdminRepository;
  player: AthleteAdminRepository;
};

/** Contract of the AthleteAdminRepository port, run against the in-memory fake AND Supabase. */
export function athleteAdminRepositoryContract(
  name: string,
  world: () => Promise<AthleteAdminWorld>,
) {
  describe(`AthleteAdminRepository contract: ${name}`, () => {
    it("lists the athlete and finds nothing for an unknown slug", async () => {
      const w = await world();

      expect((await w.admin.list()).map((a) => a.slug)).toContain(w.slug);
      expect(await w.admin.find("no-such-athlete")).toBeNull();
    });

    it("lets an admin edit the athlete, a main discipline, a PR and an SB, and remove the SB", async () => {
      const w = await world();

      expect(
        await w.admin.update(w.athleteId, { name: "Nouveau Nom", countryCode: "FRA", gender: "F" }),
      ).toBe("saved");
      expect(await w.admin.setDiscipline(w.athleteId, "200 m", true)).toBe("saved");
      expect(
        await w.admin.setRecord(w.athleteId, {
          discipline: "200 m",
          kind: "pr",
          mark: "22.10",
          value: 22.1,
          date: "2026-06-01",
        }),
      ).toBe("saved");
      expect(
        await w.admin.setRecord(w.athleteId, {
          discipline: "200 m",
          kind: "sb",
          mark: "22.40",
          value: 22.4,
          date: null,
        }),
      ).toBe("saved");
      expect(
        await w.admin.setRecord(w.athleteId, {
          discipline: "200 m",
          kind: "sb",
          mark: null,
          value: null,
          date: null,
        }),
      ).toBe("saved");

      const file = await w.admin.find(w.slug);
      expect(file).toMatchObject({ name: "Nouveau Nom", countryCode: "FRA" });
      expect(file?.disciplines).toContainEqual({ discipline: "200 m", isPrimary: true });
      expect(file?.records.filter((r) => r.discipline === "200 m")).toEqual([
        { discipline: "200 m", kind: "pr", mark: "22.10", date: "2026-06-01", meeting: null },
      ]);

      expect(await w.admin.removeDiscipline(w.athleteId, "200 m")).toBe("saved");
      expect((await w.admin.find(w.slug))?.disciplines.map((d) => d.discipline)).not.toContain(
        "200 m",
      );
    });

    it("refuses every write from a player", async () => {
      const w = await world();

      expect(
        await w.player.update(w.athleteId, { name: "X", countryCode: "FRA", gender: "F" }),
      ).toBe("not_admin");
      expect(await w.player.setDiscipline(w.athleteId, "200 m", true)).toBe("not_admin");
      expect(await w.player.removeDiscipline(w.athleteId, "200 m")).toBe("not_admin");
      expect(
        await w.player.setRecord(w.athleteId, {
          discipline: "200 m",
          kind: "pr",
          mark: "1",
          value: 1,
          date: null,
        }),
      ).toBe("not_admin");
    });

    it("lets an admin create an athlete with a free slug, and refuses a player", async () => {
      const w = await world();
      const fields = {
        name: "Inventée Bis",
        countryCode: "FRA",
        gender: "F" as const,
        slug: w.slug,
      };

      expect(await w.player.create(fields)).toBe("not_admin");
      const created = await w.admin.create(fields);

      expect(created).not.toBe("not_admin");
      const { slug } = created as { slug: string };
      expect(slug).not.toBe(w.slug);
      expect(await w.admin.find(slug)).toMatchObject({
        name: "Inventée Bis",
        countryCode: "FRA",
        gender: "F",
      });
    });
  });
}
