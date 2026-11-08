import { describe, expect, it } from "vitest";

import type { CompetitionAdminRepository } from "@/application/create-competition";

/** Two sessions, an athlete to enter, and a way to put them on a start list of a competition. */
export type CompetitionAdminWorld = {
  admin: CompetitionAdminRepository;
  player: CompetitionAdminRepository;
  athleteId: string;
  /** Puts the athlete on a start list of the competition (adds an event if needed). */
  putOnStartList: (competition: string) => Promise<void>;
};

/** Contract of the CompetitionAdminRepository port, run against the in-memory fake AND Supabase. */
export function competitionAdminRepositoryContract(
  name: string,
  world: () => Promise<CompetitionAdminWorld>,
) {
  describe(`CompetitionAdminRepository contract: ${name}`, () => {
    const tag = () => crypto.randomUUID().slice(0, 8);
    const competition = (slug: string) => ({
      slug,
      name: `Test ${slug}`,
      scope: "france" as const,
      city: "Ville",
      countryCode: "FRA",
      startsOn: "2099-06-25",
      endsOn: "2099-06-27",
      timeZone: "Europe/Paris",
    });

    it("lets an admin create a competition and an event, with free slugs, and finds them", async () => {
      const w = await world();
      const slug = `test-c-${tag()}`;

      expect(await w.admin.create(competition(slug))).toBe(slug);
      expect(await w.admin.create(competition(slug))).toBe(`${slug}-2`);
      const event = {
        slug: `${slug}-f-100-m`,
        discipline: "100 m",
        gender: "F" as const,
        round: "final" as const,
        startsAt: "2099-06-25T18:35:00.000Z",
        lockAt: "2099-06-25T18:30:00.000Z",
      };
      expect(await w.admin.addEvent(slug, event)).toBe(event.slug);
      expect(await w.admin.addEvent(`${slug}-none`, event)).toBe("unknown");

      const file = await w.admin.find(slug);
      expect(file).toMatchObject({
        name: `Test ${slug}`,
        scope: "france",
        countryCode: "FRA",
        timeZone: "Europe/Paris",
        events: 1,
        finals: 1,
      });
      expect(file?.eventList).toEqual([
        {
          slug: event.slug,
          discipline: "100 m",
          gender: "F",
          round: "final",
          startsAt: event.startsAt,
          entries: 0,
        },
      ]);
      expect((await w.admin.list()).map((c) => c.slug)).toContain(slug);

      // A heat counts as an event, not as a final players can predict (#296).
      await w.admin.addEvent(slug, { ...event, slug: `${event.slug}-series`, round: "series" });
      expect((await w.admin.list()).find((c) => c.slug === slug)).toMatchObject({
        events: 2,
        finals: 1,
      });
      expect(await w.admin.find("no-such-competition")).toBeNull();
    });

    it("enters and withdraws an athlete, but not one on a start list", async () => {
      const w = await world();
      const slug = `test-c-${tag()}`;
      await w.admin.create(competition(slug));

      expect(await w.admin.setAthlete(slug, w.athleteId, true)).toBe("saved");
      expect((await w.admin.find(slug))?.athletes.map((a) => a.athleteId)).toEqual([w.athleteId]);
      expect(await w.admin.setAthlete(slug, w.athleteId, false)).toBe("saved");
      expect((await w.admin.find(slug))?.athletes).toEqual([]);

      await w.putOnStartList(slug);
      expect(await w.admin.setAthlete(slug, w.athleteId, false)).toBe("in_use");
    });

    it("refuses every write from a player", async () => {
      const w = await world();
      const slug = `test-c-${tag()}`;

      expect(await w.player.create(competition(slug))).toBe("not_admin");
      expect(
        await w.player.addEvent(slug, {
          slug: `${slug}-e`,
          discipline: "100 m",
          gender: "F",
          round: "final",
          startsAt: "2099-06-25T18:35:00.000Z",
          lockAt: "2099-06-25T18:30:00.000Z",
        }),
      ).toBe("not_admin");
      expect(await w.player.setAthlete(slug, w.athleteId, true)).toBe("not_admin");
    });
  });
}
