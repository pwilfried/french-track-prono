import { describe, expect, it } from "vitest";

import type { CompetitionAdminRepository } from "@/application/create-competition";
import type { CompetitionEditRepository } from "@/application/edit-competition";

type Repository = CompetitionAdminRepository & CompetitionEditRepository;

/** An admin, a player, and a way to have someone predict an event. */
export type CompetitionEditWorld = {
  admin: Repository;
  player: Repository;
  predict: (eventSlug: string) => Promise<void>;
};

/** Contract of the CompetitionEditRepository port, run against the in-memory fake AND Supabase. */
export function competitionEditRepositoryContract(
  name: string,
  world: () => Promise<CompetitionEditWorld>,
) {
  describe(`CompetitionEditRepository contract: ${name}`, () => {
    const setUp = async (w: CompetitionEditWorld) => {
      const tag = Math.random().toString(36).slice(2, 8);
      const slug = (await w.admin.create({
        slug: `edit-${tag}`,
        name: `Test edit ${tag}`,
        scope: "france",
        city: null,
        countryCode: null,
        startsOn: "2099-06-10",
        endsOn: "2099-06-11",
      })) as string;
      const event = (round: "final" | "series", n: number) =>
        w.admin.addEvent(slug, {
          slug: `${slug}-f-100m-${n}`,
          discipline: "100 m",
          gender: "F",
          round,
          startsAt: "2099-06-10T18:35:00.000Z",
          lockAt: "2099-06-10T18:30:00.000Z",
        }) as Promise<string>;
      return { slug, free: await event("series", 1), predicted: await event("final", 2) };
    };

    it("lets the admin correct a competition and move an event", async () => {
      const w = await world();
      const { slug, free } = await setUp(w);

      expect(
        await w.admin.update(slug, {
          name: "Test edit bis",
          scope: "international",
          city: "Lyon",
          countryCode: "FRA",
          startsOn: "2099-06-10",
          endsOn: "2099-06-12",
        }),
      ).toBe("saved");
      expect(
        await w.admin.updateEvent(free, {
          round: "final",
          startsAt: "2099-06-11T18:35:00.000Z",
          lockAt: "2099-06-11T18:30:00.000Z",
        }),
      ).toBe("saved");

      const file = await w.admin.find(slug);
      expect(file).toMatchObject({ name: "Test edit bis", scope: "international", city: "Lyon" });
      expect(file?.eventList.find((e) => e.slug === free)).toMatchObject({
        round: "final",
        startsAt: "2099-06-11T18:35:00.000Z",
      });
      await w.admin.removeEvent(free);
      await w.admin.remove(slug);
    });

    it("keeps what was predicted, deletes the rest, and refuses a player", async () => {
      const w = await world();
      const { slug, free, predicted } = await setUp(w);
      await w.predict(predicted);
      const move = { startsAt: "2099-06-10T18:35:00.000Z", lockAt: "2099-06-10T18:30:00.000Z" };

      expect(await w.player.removeEvent(free)).toBe("not_admin");
      expect(await w.admin.updateEvent(predicted, { round: "semi", ...move })).toBe(
        "has_predictions",
      );
      expect(await w.admin.removeEvent(predicted)).toBe("has_predictions");
      expect(await w.admin.remove(slug)).toBe("has_predictions");
      expect(await w.admin.removeEvent(free)).toBe("saved");
      expect(await w.admin.removeEvent(free)).toBe("unknown");
      expect((await w.admin.find(slug))?.eventList.map((e) => e.slug)).toEqual([predicted]);
    });
  });
}
