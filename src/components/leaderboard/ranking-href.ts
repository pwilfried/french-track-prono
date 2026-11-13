/** The views of the rankings tab (#551). */
export const RANKING_VIEWS = ["ligue", "soir", "general"] as const;
export type RankingView = (typeof RANKING_VIEWS)[number];

/** The address of a view of the ranking, with its league or competition when there is one. */
export function rankingHref(
  view: RankingView,
  extra: { ligue?: string; competition?: string } = {},
) {
  const query = new URLSearchParams({ vue: view });
  if (extra.ligue) query.set("ligue", extra.ligue);
  if (extra.competition) query.set("competition", extra.competition);
  return `/classement?${query}`;
}
