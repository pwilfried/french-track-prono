import { describe, expect, it } from "vitest";

import type { FrenchTrackRepository } from "@/application/frenchtrack";

/**
 * Two open events of their own, `eventId` and `otherEventId`, with the start list `athleteIds`;
 * `outsiderId` is not on it. `admin` reads as the admin, `bob` as a player (`bobId`). `lock`
 * locks an event, `score` stores the points of the players as the admin computes them.
 */
export type FrenchTrackWorld = {
  eventId: string;
  otherEventId: string;
  athleteIds: string[];
  outsiderId: string;
  year: number;
  adminId: string;
  bobId: string;
  admin: FrenchTrackRepository;
  bob: FrenchTrackRepository;
  lock(eventId: string): void;
  score(eventId: string, lines: Record<string, number>): void;
};

/** Contract of the FrenchTrackRepository port, run against the in-memory fake AND Supabase. */
export function frenchTrackRepositoryContract(
  name: string,
  world: () => Promise<FrenchTrackWorld>,
) {
  describe(`FrenchTrackRepository contract: ${name}`, () => {
    const podiumOf = (w: FrenchTrackWorld) => {
      const [a, b, c] = w.athleteIds as [string, string, string];
      return { first: a, second: b, third: c };
    };

    it("lets only the admin post the podium of FrenchTrack", async () => {
      const w = await world();

      expect(await w.bob.savePick(w.eventId, podiumOf(w))).toBe("not_admin");
      expect(await w.bob.challenge(w.eventId)).toBeNull();
      expect(await w.admin.savePick(w.eventId, podiumOf(w))).toBe("saved");
    });

    it("refuses an athlete who is not on the start list", async () => {
      const w = await world();

      expect(await w.admin.savePick(w.eventId, { ...podiumOf(w), third: w.outsiderId })).toBe(
        "invalid",
      );
    });

    it("hides the podium of FrenchTrack from the players until the lock", async () => {
      const w = await world();
      await w.admin.savePick(w.eventId, podiumOf(w));

      expect(await w.bob.challenge(w.eventId)).toEqual({
        locked: false,
        podium: null,
        points: null,
        mine: null,
        scores: [],
      });
      expect((await w.admin.challenge(w.eventId))?.podium).toEqual(podiumOf(w));

      w.lock(w.eventId);

      expect((await w.bob.challenge(w.eventId))?.podium).toEqual(podiumOf(w));
      expect(await w.admin.savePick(w.eventId, podiumOf(w))).toBe("locked");
      expect(await w.admin.removePick(w.eventId)).toBe("locked");
    });

    it("removes a challenge before the lock", async () => {
      const w = await world();
      await w.admin.savePick(w.otherEventId, podiumOf(w));

      expect(await w.admin.removePick(w.otherEventId)).toBe("removed");
      expect(await w.bob.challenge(w.otherEventId)).toBeNull();
    });

    it("gives FrenchTrack's points with mine and the season once computed", async () => {
      const w = await world();
      await w.admin.savePick(w.eventId, podiumOf(w));
      w.lock(w.eventId);
      w.score(w.eventId, { [w.bobId]: 12, [w.adminId]: 0 });

      expect(await w.admin.saveScore(w.eventId, 5)).toBe("saved");
      expect(await w.bob.saveScore(w.eventId, 99)).toBe("not_admin");

      expect(await w.bob.challenge(w.eventId)).toMatchObject({
        locked: true,
        points: 5,
        mine: 12,
        scores: [0, 12],
      });
      const listed = (await w.bob.challenges(w.year)).find((c) => c.eventId === w.eventId);
      expect(listed).toMatchObject({ points: 5, mine: 12 });
      const season = (await w.bob.season(w.year)).filter((l) => l.eventId === w.eventId);
      expect(season.map((l) => [l.userId, l.points, l.frenchTrackPoints]).sort()).toEqual(
        [
          [w.bobId, 12, 5],
          [w.adminId, 0, 5],
        ].sort(),
      );
    });
  });
}
