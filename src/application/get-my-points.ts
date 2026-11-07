import type { ScoreReason } from "@/domain/scoring";

import type { PointsRepository } from "./compute-event-points";

export type MyEventPoints = {
  eventId: string;
  points: number;
  reasons: ScoreReason[];
  joker: boolean;
};
export type MyPoints = { total: number; events: MyEventPoints[] };

/** The player's points in a competition: the total and where each point comes from. */
export function getMyPoints(ports: { points: PointsRepository }) {
  return {
    async execute(input: { userId: string; competitionSlug: string }): Promise<MyPoints> {
      const lines = await ports.points.listMine(input.userId, input.competitionSlug);
      const events = lines.map((line) => ({
        eventId: line.eventId,
        points: line.points,
        reasons: line.reasons,
        joker: line.reasons.some((reason) => reason.kind === "joker"),
      }));
      return { total: events.reduce((sum, e) => sum + e.points, 0), events };
    },
  };
}
