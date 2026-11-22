import type { LeagueFamilyRule } from "@/domain/league-families";
import {
  feedGroups,
  leagueMoments,
  type FeedGroup,
  type FeedMoment,
  type LeagueMoment,
} from "@/domain/league-moments";

import { UseCaseError } from "./errors";
import type { LeagueJokerPlay } from "./league-jokers";
import {
  leagueLines,
  linesOf,
  withLeagueJokers,
  type RankingLine,
  type RankingRepository,
} from "./rankings";

/** A league as the publication of its moments needs it: what its ranking counts. */
export type MomentLeague = {
  id: string;
  competitionSlugs: string[];
  competitionAddedAt?: Record<string, string>;
  families?: LeagueFamilyRule[];
  /** `countedEvents`: the predictions each member added to the league (#1068). */
  members: { userId: string; joinedAt?: string; countedEvents?: string[] }[];
  /** The jokers played in the league (#1114), counted like in its ranking; absent: none. */
  jokerPlays?: LeagueJokerPlay[];
};

/**
 * Port: the moments of the leagues (#671). Real adapter = Supabase (the admin publishes, a member
 * reads the feed of their leagues), fake = in memory.
 */
export interface LeagueMomentRepository {
  /** Every league counting the competition. Admin only. */
  leaguesOf(competitionSlug: string): Promise<MomentLeague[] | "not_admin">;
  /**
   * Publishes moments in a league; a fact already published, or a player who is not a member, is
   * left out. Returns how many are new. Admin only.
   */
  publish(leagueId: string, moments: LeagueMoment[]): Promise<number | "not_admin">;
  /** The feed of a league, latest first; empty for someone outside the league. */
  feed(leagueId: string): Promise<FeedMoment[]>;
}

/**
 * Once the points of an event are computed, publishes the moments of every league counting its
 * competition: perfect podiums, new leaders, streaks. Run again, it publishes nothing new.
 */
export function publishLeagueMoments(ports: {
  moments: LeagueMomentRepository;
  ranking: RankingRepository;
}) {
  return {
    async execute(input: { competitionSlug: string }): Promise<number> {
      const leagues = await ports.moments.leaguesOf(input.competitionSlug);
      if (leagues === "not_admin") throw new UseCaseError("NOT_ADMIN");
      // Each competition is read once, whatever the number of leagues counting it.
      const read = new Map<string, Promise<RankingLine[]>>();
      const linesOfCompetition = (slug: string) => {
        if (!read.has(slug)) read.set(slug, linesOf(ports.ranking, [slug]));
        return read.get(slug)!;
      };
      let published = 0;
      for (const league of leagues) {
        const lines = (await Promise.all(league.competitionSlugs.map(linesOfCompetition))).flat();
        const moments = leagueMoments(
          withLeagueJokers(leagueLines(lines, league), league.jokerPlays ?? []),
        );
        if (moments.length === 0) continue;
        const count = await ports.moments.publish(league.id, moments);
        if (count === "not_admin") throw new UseCaseError("NOT_ADMIN");
        published += count;
      }
      return published;
    },
  };
}

/** The feed of a league, grouped « Ce soir · <compétition> », « Hier », then by day. */
export function getLeagueFeed(ports: { moments: LeagueMomentRepository; now?: () => Date }) {
  const now = ports.now ?? (() => new Date());
  return {
    async execute(input: { leagueId: string }): Promise<FeedGroup[]> {
      return feedGroups(await ports.moments.feed(input.leagueId), now().toISOString());
    },
  };
}
