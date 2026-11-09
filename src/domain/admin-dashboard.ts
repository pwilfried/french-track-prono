const WEEK = 7 * 24 * 60 * 60 * 1000;

export type PlayerStats = {
  total: number;
  activeThisWeek: number;
  /** Rounded percentage of players with at least one prediction. */
  predictedShare: number;
  /** New players in each of the last 8 weeks (7-day windows ending now), the oldest first. */
  newPerWeek: number[];
};

/** The « Joueurs » block of the back-office dashboard (#379). */
export function playerStats(
  players: readonly { joinedAt: string; lastActiveAt: string; predictions: number }[],
  now: Date,
): PlayerStats {
  const at = now.getTime();
  const newPerWeek = Array.from({ length: 8 }, () => 0);
  for (const p of players) {
    const week = Math.floor((at - Date.parse(p.joinedAt)) / WEEK);
    if (week >= 0 && week < 8) newPerWeek[7 - week]! += 1;
  }
  const predicted = players.filter((p) => p.predictions > 0).length;
  return {
    total: players.length,
    activeThisWeek: players.filter((p) => at - Date.parse(p.lastActiveAt) < WEEK).length,
    predictedShare: players.length ? Math.round((predicted / players.length) * 100) : 0,
    newPerWeek,
  };
}
