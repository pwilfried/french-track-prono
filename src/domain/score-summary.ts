/** What a computation gives out on one event, for the back-office. */
export type ScoreSummary = {
  players: number;
  total: number;
  average: number;
  best: number;
  atZero: number;
};

export function scoreSummary(points: number[]): ScoreSummary {
  const total = points.reduce((sum, p) => sum + p, 0);
  return {
    players: points.length,
    total,
    average: points.length === 0 ? 0 : total / points.length,
    best: points.length === 0 ? 0 : Math.max(...points),
    atZero: points.filter((p) => p === 0).length,
  };
}
