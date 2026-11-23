type OfferLeague = { id: string; counted: boolean };

export type LeagueOffer = {
  /** The league the player comes from, when a member whose league counts the competition. */
  origin: string | undefined;
  /** The leagues the sheet asks about: never the origin, never one already counted. */
  offered: string[];
  /** Nothing to ask, a plain question for one league, or a list to tick. */
  mode: "none" | "one" | "list";
};

/**
 * What the sheet « Ajouter ce prono à mes ligues » asks after a save (#1147). A requested league
 * that is not among the player's leagues counting the competition is ignored (no origin).
 */
export function leagueOffer(leagues: OfferLeague[], requested?: string): LeagueOffer {
  const origin = leagues.find((l) => l.id === requested)?.id;
  // Outside a league, the sheet only comes while the prediction counts nowhere yet.
  const asks = origin !== undefined || !leagues.some((l) => l.counted);
  const offered = asks ? leagues.filter((l) => l.id !== origin && !l.counted).map((l) => l.id) : [];
  return {
    origin,
    offered,
    mode: offered.length === 0 ? "none" : offered.length === 1 ? "one" : "list",
  };
}
