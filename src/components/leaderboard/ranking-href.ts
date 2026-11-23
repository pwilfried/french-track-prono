/** The views of the rankings tab (#551). */
export const RANKING_VIEWS = ["ligue", "soir", "general"] as const;
export type RankingView = (typeof RANKING_VIEWS)[number];

/** The `ligue` of « Ce soir » for all players, not one league (#1132). */
export const ALL_PLAYERS = "tous";

/** The address of a view of the ranking, with its league or competition when there is one. */
export function rankingHref(
  view: RankingView,
  extra: { ligue?: string; competition?: string; clubs?: boolean } = {},
) {
  const query = new URLSearchParams({ vue: view });
  if (extra.ligue) query.set("ligue", extra.ligue);
  if (extra.competition) query.set("competition", extra.competition);
  if (extra.clubs) query.set("clubs", "1");
  return `/classement?${query}`;
}
