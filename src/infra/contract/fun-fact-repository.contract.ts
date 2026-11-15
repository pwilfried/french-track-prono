import { describe, expect, it } from "vitest";

import type { FunFactRepository } from "@/application/fun-facts";
import type { FunFactDraft } from "@/domain/fun-facts";

export type FunFactWorld = {
  admin: FunFactRepository;
  player: FunFactRepository;
  /** A competition and a discipline the facts may be tied to. */
  competitionSlug: string;
  discipline: string;
};

const draft = (title: string, change: Partial<FunFactDraft> = {}): FunFactDraft => ({
  title,
  body: "Un fait vérifié pour le test de contrat.",
  tag: "oddity",
  source: "https://example.test/source",
  active: true,
  competitionSlug: null,
  discipline: null,
  startsOn: null,
  endsOn: null,
  ...change,
});

/** Contract of the FunFactRepository port (#766), run against the fake AND Supabase. */
export function funFactRepositoryContract(name: string, world: () => Promise<FunFactWorld>) {
  describe(`FunFactRepository contract: ${name}`, () => {
    it("lets the admin add, edit, disable and delete a fact the player reads without its source", async () => {
      const w = await world();
      const title = `Contrat ${crypto.randomUUID().slice(0, 8)}`;
      const id = await w.admin.save(
        null,
        draft(title, {
          competitionSlug: w.competitionSlug,
          discipline: w.discipline,
          startsOn: "2031-07-10",
          endsOn: "2031-07-12",
        }),
      );

      expect((await w.admin.all()).find((f) => f.id === id)).toMatchObject({
        title,
        source: "https://example.test/source",
        competitionSlug: w.competitionSlug,
        discipline: w.discipline,
        startsOn: "2031-07-10",
        endsOn: "2031-07-12",
      });
      const read = (await w.player.active()).find((f) => f.id === id);
      expect(read).toEqual({
        id,
        title,
        body: "Un fait vérifié pour le test de contrat.",
        tag: "oddity",
        competitionSlug: w.competitionSlug,
        discipline: w.discipline,
        startsOn: "2031-07-10",
        endsOn: "2031-07-12",
      });

      await w.admin.save(id, draft(`${title} corrigé`, { active: false }));
      expect((await w.admin.all()).find((f) => f.id === id)).toMatchObject({
        title: `${title} corrigé`,
        active: false,
        competitionSlug: null,
      });
      expect((await w.player.active()).some((f) => f.id === id)).toBe(false);

      await w.admin.remove(id);
      expect((await w.admin.all()).some((f) => f.id === id)).toBe(false);
    });

    it("refuses a fact tied to an unknown competition", async () => {
      const w = await world();
      await expect(
        w.admin.save(null, draft("Nulle part", { competitionSlug: "nulle-part-9999" })),
      ).rejects.toMatchObject({ code: "FUN_FACT_TIE_INVALID" });
    });

    it("lets only the admin switch the card and read the sources", async () => {
      const w = await world();
      await expect(w.player.all()).rejects.toMatchObject({ code: "NOT_ADMIN" });
      await expect(w.player.setEnabled(false)).rejects.toMatchObject({ code: "NOT_ADMIN" });
      await expect(w.player.save(null, draft("Moi"))).rejects.toMatchObject({ code: "NOT_ADMIN" });

      await w.admin.setEnabled(false);
      try {
        expect(await w.player.enabled()).toBe(false);
      } finally {
        await w.admin.setEnabled(true);
      }
      expect(await w.player.enabled()).toBe(true);
    });
  });
}
