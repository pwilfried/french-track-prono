import { describe, expect, it } from "vitest";

import { playerStats } from "./admin-dashboard";

const NOW = new Date("2026-11-09T12:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 24 * 3600 * 1000).toISOString();
const player = (joined: number, active: number, predictions: number) => ({
  joinedAt: daysAgo(joined),
  lastActiveAt: daysAgo(active),
  predictions,
});

describe("player stats of the dashboard", () => {
  it("counts the players, the active ones this week and the share who predicted", () => {
    const stats = playerStats([player(30, 1, 3), player(20, 10, 0), player(2, 2, 1)], NOW);
    expect(stats).toMatchObject({ total: 3, activeThisWeek: 2, predictedShare: 67 });
  });

  it("gives the new players of each of the last 8 weeks, the oldest first", () => {
    const stats = playerStats(
      [player(1, 1, 0), player(6, 6, 0), player(8, 8, 0), player(60, 1, 0)],
      NOW,
    );
    expect(stats.newPerWeek).toEqual([0, 0, 0, 0, 0, 0, 1, 2]);
  });

  it("says 0 % when nobody signed up yet", () => {
    expect(playerStats([], NOW)).toEqual({
      total: 0,
      activeThisWeek: 0,
      predictedShare: 0,
      newPerWeek: [0, 0, 0, 0, 0, 0, 0, 0],
    });
  });
});
