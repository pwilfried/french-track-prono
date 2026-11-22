import type {
  CatalogueJoker,
  JokerOutcome,
  LeagueJokerPlay,
  LeagueJokerRepository,
} from "@/application/league-jokers";
import type { JokerGame } from "@/domain/league-jokers";

/** What the fake knows: the catalogue, the leagues of the players, the events and their predictions. */
export type LeagueJokerWorld = {
  catalogue?: Record<JokerGame, CatalogueJoker[]>;
  /** Each league with its members, its jokers and the events it counts. */
  leagues: { id: string; members: string[]; jokers: string[]; events: string[] }[];
  events: { id: string; lockAt: string }[];
  /** The predictions added to a league, as `league:user:event`. */
  counted: string[];
  now?: () => Date;
};

/**
 * Test double of the LeagueJokerRepository port (#1090), with the rules of the database: once per
 * league, one per event, on a prediction added to the league (the spy too, #1121), until the
 * lock, never the spy taken back; the others see a joker once locked.
 * One store shared by every session, one session per player.
 */
export function createInMemoryLeagueJokerStore(world: LeagueJokerWorld) {
  const now = world.now ?? (() => new Date());
  const catalogue: Record<JokerGame, CatalogueJoker[]> = world.catalogue ?? {
    predictions: ["double", "all_or_nothing", "safety_net", "spy", "outsider"].map((joker) => ({
      joker,
      active: true,
    })),
    manager: [],
  };
  const plays: (LeagueJokerPlay & { leagueId: string })[] = [];
  const open = (eventId: string) => {
    const event = world.events.find((e) => e.id === eventId);
    return !!event && Date.parse(event.lockAt) > now().getTime();
  };

  return {
    session(options: { userId: string; isAdmin?: boolean }): LeagueJokerRepository {
      const { userId } = options;
      const leagueOf = (id: string) =>
        world.leagues.find((l) => l.id === id && l.members.includes(userId));
      const check = (leagueId: string, eventId: string): JokerOutcome | null => {
        if (!leagueOf(leagueId)) return "not_member";
        if (!open(eventId)) return "locked";
        return null;
      };
      return {
        async catalogue(game) {
          return catalogue[game].map((j) => ({ ...j }));
        },
        async setActive(game, joker, active) {
          if (!options.isAdmin) return "not_admin";
          const found = catalogue[game].find((j) => j.joker === joker);
          if (!found) return "unknown";
          found.active = active;
          return "saved";
        },
        async leagueJokers(leagueId) {
          return [...(leagueOf(leagueId)?.jokers ?? [])];
        },
        async plays(leagueId) {
          if (!leagueOf(leagueId)) return [];
          return plays
            .filter((p) => p.leagueId === leagueId && (p.userId === userId || !open(p.eventId)))
            .map((p) => ({ userId: p.userId, eventId: p.eventId, joker: p.joker }));
        },
        async play(leagueId, eventId, joker) {
          const refused = check(leagueId, eventId);
          if (refused) return refused;
          const league = leagueOf(leagueId)!;
          const mine = plays.filter((p) => p.leagueId === leagueId && p.userId === userId);
          if (
            !league.jokers.includes(joker) ||
            mine.some((p) => p.joker === joker && p.eventId !== eventId)
          ) {
            return "not_available";
          }
          const counted = world.counted.includes(`${leagueId}:${userId}:${eventId}`);
          if (!league.events.includes(eventId) || !counted) return "not_in_league";
          const onEvent = mine.find((p) => p.eventId === eventId);
          if (onEvent?.joker === joker) return "done";
          if (onEvent?.joker === "spy") return "spy_spent";
          if (onEvent) plays.splice(plays.indexOf(onEvent), 1);
          plays.push({ leagueId, userId, eventId, joker });
          return "done";
        },
        async remove(leagueId, eventId) {
          const refused = check(leagueId, eventId);
          if (refused) return refused;
          const onEvent = plays.find(
            (p) => p.leagueId === leagueId && p.userId === userId && p.eventId === eventId,
          );
          if (onEvent?.joker === "spy") return "spy_spent";
          if (onEvent) plays.splice(plays.indexOf(onEvent), 1);
          return "done";
        },
      };
    },
  };
}
