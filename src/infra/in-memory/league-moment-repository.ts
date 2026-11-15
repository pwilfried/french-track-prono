import type { LeagueMomentRepository, MomentLeague } from "@/application/league-moments";
import { unpublished, type FeedMoment, type LeagueMoment } from "@/domain/league-moments";

/** An event as the feed tells it. */
export type MomentEventFixture = {
  startsAt: string;
  discipline: string;
  gender: "F" | "M" | "X";
  competitionName: string;
};

type Stored = LeagueMoment & { leagueId: string; happenedAt: string };

/**
 * Test double of the LeagueMomentRepository port: one store, seen by each player through
 * `as(viewerId)` (an admin through `as(id, { admin: true })`). `pseudos` names the players,
 * `events` the events the moments are about.
 */
export function createInMemoryLeagueMomentStore(world: {
  leagues: MomentLeague[];
  pseudos?: Record<string, string>;
  events?: Record<string, MomentEventFixture>;
  now?: () => Date;
}): {
  as(viewerId: string, options?: { admin?: boolean }): LeagueMomentRepository;
  stored(): Stored[];
} {
  const now = world.now ?? (() => new Date());
  const stored: Stored[] = [];
  const isMember = (leagueId: string, userId: string) =>
    world.leagues.some((l) => l.id === leagueId && l.members.some((m) => m.userId === userId));

  const as = (viewerId: string, options: { admin?: boolean } = {}): LeagueMomentRepository => ({
    async leaguesOf(competitionSlug) {
      if (!options.admin) return "not_admin";
      return world.leagues.filter((l) => l.competitionSlugs.includes(competitionSlug));
    },

    async publish(leagueId, moments) {
      if (!options.admin) return "not_admin";
      const known = stored.filter((s) => s.leagueId === leagueId).map((s) => s.key);
      const fresh = unpublished(
        known,
        moments.filter((m) => isMember(leagueId, m.userId)),
      );
      for (const moment of fresh) {
        const happenedAt = world.events?.[moment.eventId]?.startsAt ?? now().toISOString();
        stored.push({ ...moment, leagueId, happenedAt });
      }
      return fresh.length;
    },

    async feed(leagueId) {
      if (!isMember(leagueId, viewerId)) return [];
      return stored
        .filter((s) => s.leagueId === leagueId)
        .sort((a, b) => b.happenedAt.localeCompare(a.happenedAt) || a.key.localeCompare(b.key))
        .map((s): FeedMoment => {
          const event = world.events?.[s.eventId];
          return {
            key: s.key,
            kind: s.kind,
            happenedAt: s.happenedAt,
            pseudo: world.pseudos?.[s.userId] ?? s.userId,
            ...(event
              ? {
                  competitionName: event.competitionName,
                  event: { discipline: event.discipline, gender: event.gender },
                }
              : {}),
            ...(s.length !== undefined ? { length: s.length } : {}),
          };
        });
    },
  });

  return { as, stored: () => [...stored] };
}
