import type { PredictionLeagueRepository } from "@/application/prediction-leagues";

/** What the fake knows: the player's leagues, the events and the player's predictions. */
export type PredictionLeagueWorld = {
  /** The leagues of the signed-in player, with the competitions each counts. */
  leagues: { id: string; competitionSlugs: string[] }[];
  events: { id: string; competitionSlug: string; lockAt: string }[];
  /** The events the signed-in player has a prediction on. */
  predicted: string[];
  now?: () => Date;
};

/** Test double of the PredictionLeagueRepository port (#1068), for one signed-in player. */
export function createInMemoryPredictionLeagueRepository(
  world: PredictionLeagueWorld,
): PredictionLeagueRepository {
  const now = world.now ?? (() => new Date());
  /** League ids by event id. */
  const links = new Map<string, string[]>();
  return {
    async leaguesOf(_userId, eventId) {
      return [...(links.get(eventId) ?? [])].sort();
    },
    async set(eventId, leagueIds) {
      const event = world.events.find((e) => e.id === eventId);
      if (event && Date.parse(event.lockAt) <= now().getTime()) return "locked";
      if (!event || !world.predicted.includes(eventId)) return "refused";
      const counts = (id: string) =>
        world.leagues.some(
          (l) => l.id === id && l.competitionSlugs.includes(event.competitionSlug),
        );
      if (!leagueIds.every(counts)) return "refused";
      links.set(eventId, [...new Set(leagueIds)]);
      return "done";
    },
  };
}
