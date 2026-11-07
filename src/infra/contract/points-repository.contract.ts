import { describe, expect, it } from "vitest";

import type { PointsRepository, ScoreLine } from "@/application/compute-event-points";
import { DEFAULT_RULES } from "@/domain/scoring";

/**
 * A locked event of its own with an official podium (athletes[0], [1], [2] in this order) and two
 * predictions: the admin's (perfect podium, joker) and the player's (winner only, no joker).
 */
export type PointsWorld = {
  eventId: string;
  athleteIds: string[];
  adminId: string;
  playerId: string;
  admin: PointsRepository;
  player: PointsRepository;
};

/** Contract of the PointsRepository port, run against the in-memory fake AND Supabase. */
export function pointsRepositoryContract(name: string, world: () => Promise<PointsWorld>) {
  const byUser = (lines: ScoreLine[]) =>
    [...lines].sort((a, b) => a.userId.localeCompare(b.userId));

  describe(`PointsRepository contract: ${name}`, () => {
    it("loads an event with its result, all its predictions and the scoring rules", async () => {
      const w = await world();

      const event = await w.admin.loadEvent(w.eventId);

      expect(Date.parse(event!.lockAt)).toBeLessThanOrEqual(Date.now());
      expect([...event!.results].sort((a, b) => a.rank - b.rank)).toEqual([
        { athleteId: w.athleteIds[0], rank: 1 },
        { athleteId: w.athleteIds[1], rank: 2 },
        { athleteId: w.athleteIds[2], rank: 3 },
      ]);
      expect(event!.predictions.map((p) => [p.userId, p.first, p.useJoker]).sort()).toEqual(
        [
          [w.adminId, w.athleteIds[0], true],
          [w.playerId, w.athleteIds[0], false],
        ].sort(),
      );
      expect(event!.rules).toEqual(DEFAULT_RULES);
    });

    it("loads nothing for an unknown event", async () => {
      const w = await world();

      expect(await w.admin.loadEvent(crypto.randomUUID())).toBeNull();
    });

    it("lets an admin replace the score lines of an event, without duplicates", async () => {
      const w = await world();
      const lines: ScoreLine[] = [
        { userId: w.adminId, points: 24, reasons: [{ kind: "perfect_podium" }, { kind: "joker" }] },
        { userId: w.playerId, points: 3, reasons: [{ kind: "exact", slot: 1 }] },
      ];

      expect(await w.admin.replaceEventScores(w.eventId, lines)).toBe("saved");
      expect(await w.admin.replaceEventScores(w.eventId, lines)).toBe("saved");

      expect(byUser(await w.player.findEventScores(w.eventId))).toEqual(byUser(lines));
    });

    it("refuses a player who is not admin and keeps the points", async () => {
      const w = await world();
      const lines: ScoreLine[] = [{ userId: w.playerId, points: 3, reasons: [] }];
      await w.admin.replaceEventScores(w.eventId, lines);

      expect(await w.player.replaceEventScores(w.eventId, [])).toBe("not_admin");

      expect(await w.player.findEventScores(w.eventId)).toEqual(lines);
    });
  });
}
