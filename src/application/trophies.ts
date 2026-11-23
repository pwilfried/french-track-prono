import type { LeagueFamilyRule } from "@/domain/league-families";
import { PSEUDO_MAX_LENGTH } from "@/domain/profile";
import {
  competitionOver,
  freshTrophies,
  generalTrophies,
  leagueOver,
  leagueSeason,
  leagueTrophies,
  managerTrophies,
  seasonOf,
  seasonOver,
  seasonsToDraw,
  trophyMoments,
  trophyShelves,
  witnessTrophies,
  type FinishedManagerLeague,
  type SeasonCompetition,
  type Trophy,
  type TrophyMoment,
  type TrophyShelf,
} from "@/domain/trophies";

import { UseCaseError } from "./errors";
import type { LeagueJokerPlay } from "./league-jokers";
import { leagueLines, linesOf, withLeagueJokers, type RankingRepository } from "./rankings";

/** A predictions league as the trophies need it. */
export type TrophyLeague = {
  id: string;
  name: string;
  /** `countedEvents`: the predictions each member added to the league (#1068). */
  members: { userId: string; joinedAt?: string; countedEvents?: string[] }[];
  /** Its competitions, with when each entered the league (#614; null: from the start). */
  competitions: (SeasonCompetition & { addedAt: string | null })[];
  families: LeagueFamilyRule[];
  /** The jokers played in the league (#1114), counted like in its ranking; absent: none. */
  jokerPlays?: LeagueJokerPlay[];
};

/** Everything the trophies of a season are drawn from, but the score lines. */
export type SeasonFacts = {
  /** The FrenchTrack account of the Témoin d'or; null when the admin set none. */
  witnessId: string | null;
  /** The competitions ending in the season, and those of its leagues. */
  competitions: SeasonCompetition[];
  /** The predictions leagues whose last competition ends in the season. */
  leagues: TrophyLeague[];
  /** The Manager seasons that ended in the season, Paris time. */
  manager: FinishedManagerLeague[];
};

/**
 * What a draw announces (#1134): the moments of the league feeds, and the fresh trophies, each
 * notified to its winner. The same announcement made twice is kept once.
 */
export type TrophyAnnouncements = { moments: TrophyMoment[]; news: Trophy[] };

/**
 * Port: the season trophies (#822). Real adapter = Supabase (the admin draws them, every player
 * reads their own and those of the players of their leagues), fake = in memory.
 */
export interface TrophyRepository {
  /** Admin only: throws NOT_ADMIN otherwise. */
  seasonFacts(season: number): Promise<SeasonFacts>;
  /** Admin only: every trophy of the season, all players. */
  seasonTrophies(season: number): Promise<Trophy[]>;
  /**
   * Admin only: replaces every trophy of the season and publishes the announcements, in one go.
   * A trophy kept keeps its row.
   */
  replaceSeason(
    season: number,
    trophies: Trophy[],
    announcements: TrophyAnnouncements,
  ): Promise<void>;
  /** The trophies of a player, any season. */
  ofPlayer(userId: string): Promise<Trophy[]>;
  /** The player's own trophies not celebrated yet (#1135); those won before it count as seen. */
  unseen(userId: string): Promise<Trophy[]>;
  /** The signed-in player has closed the celebration: their trophies count as seen, only theirs. */
  markSeen(): Promise<void>;
  /** Admin only: the pseudo of the FrenchTrack account, null when none is set. */
  witness(): Promise<string | null>;
  /** Admin only: an empty pseudo sets none. */
  setWitness(pseudo: string): Promise<"saved" | "cleared" | "unknown">;
}

/**
 * Draws the trophies of a season and replaces them (#822): the podium and the feats of each
 * finished predictions league, the Manager podiums, the Témoin d'or of each finished competition
 * and, once the year is over, the laurels of the general ranking. Can be run again at any time:
 * the season's trophies are replaced, never duplicated. The fresh ones (absent before, or now in
 * another metal) are announced (#1134): in the feed of their league, and to their winner.
 */
export function awardSeasonTrophies(ports: {
  trophies: TrophyRepository;
  ranking: RankingRepository;
  /** YYYY-MM-DD, Paris time. */
  today: () => string;
}) {
  return {
    async execute(input: { season: number }): Promise<{ trophies: Trophy[]; fresh: Trophy[] }> {
      const today = ports.today();
      const before = await ports.trophies.seasonTrophies(input.season);
      const facts = await ports.trophies.seasonFacts(input.season);
      const finished = facts.leagues.filter((l) => leagueOver(l.competitions, today));
      const ofSeason = facts.competitions.filter(
        (c) => seasonOf(c.endsOn) === input.season && competitionOver(c, today),
      );
      const slugs = [
        ...new Set([...ofSeason, ...finished.flatMap((l) => l.competitions)].map((c) => c.slug)),
      ];
      const lines = await linesOf(ports.ranking, slugs);

      const trophies = [
        ...finished.flatMap((league) =>
          leagueTrophies({
            id: league.id,
            name: league.name,
            season: leagueSeason(league.competitions),
            memberIds: league.members.map((m) => m.userId),
            competitions: league.competitions,
            lines: withLeagueJokers(
              leagueLines(
                lines.filter((l) => league.competitions.some((c) => c.slug === l.competitionSlug)),
                {
                  members: league.members,
                  families: league.families,
                  competitionAddedAt: Object.fromEntries(
                    league.competitions.flatMap((c) => (c.addedAt ? [[c.slug, c.addedAt]] : [])),
                  ),
                },
              ),
              league.jokerPlays ?? [],
            ),
          }),
        ),
        ...facts.manager.flatMap(managerTrophies),
        ...witnessTrophies(
          input.season,
          facts.witnessId,
          ofSeason.map((c) => ({ lines: lines.filter((l) => l.competitionSlug === c.slug) })),
        ),
        ...(seasonOver(input.season, today)
          ? generalTrophies(
              input.season,
              lines.filter((l) => ofSeason.some((c) => c.slug === l.competitionSlug)),
            )
          : []),
      ].filter((t) => t.season === input.season);
      const fresh = freshTrophies(before, trophies);
      await ports.trophies.replaceSeason(input.season, trophies, {
        moments: trophyMoments(fresh, trophies),
        news: fresh,
      });
      return { trophies, fresh };
    },
  };
}

/**
 * The daily draw (#1134): the trophies of the current season and, in January, of the one just
 * over, with the rules of awardSeasonTrophies. Run twice, it neither duplicates nor announces
 * anything again.
 */
export function awardDueTrophies(ports: Parameters<typeof awardSeasonTrophies>[0]) {
  return {
    async execute(): Promise<{ season: number; awarded: number; fresh: number }[]> {
      const award = awardSeasonTrophies(ports);
      const done = [];
      for (const season of seasonsToDraw(ports.today())) {
        const { trophies, fresh } = await award.execute({ season });
        done.push({ season, awarded: trophies.length, fresh: fresh.length });
      }
      return done;
    },
  };
}

/** The showcase of a player (#822): one shelf per season, the latest first. */
export function getTrophyShowcase(ports: { trophies: TrophyRepository }) {
  return {
    async execute(input: { userId: string }): Promise<TrophyShelf[]> {
      return trophyShelves(await ports.trophies.ofPlayer(input.userId));
    },
  };
}

/** The trophies to celebrate on the profile (#1135), in the order of the shelf. */
export function getNewTrophies(ports: { trophies: TrophyRepository }) {
  return {
    async execute(input: { userId: string }): Promise<Trophy[]> {
      return trophyShelves(await ports.trophies.unseen(input.userId)).flatMap(
        (shelf) => shelf.trophies,
      );
    },
  };
}

/** The celebration is closed: the player's trophies are not celebrated again (#1135). */
export function markTrophiesSeen(ports: { trophies: TrophyRepository }) {
  return {
    async execute(): Promise<void> {
      await ports.trophies.markSeen();
    },
  };
}

/** Sets the FrenchTrack account of the Témoin d'or by its pseudo; empty: none (#807). */
export function setTrophyWitness(ports: { trophies: TrophyRepository }) {
  return {
    async execute(input: { pseudo: string }): Promise<"saved" | "cleared"> {
      const pseudo = input.pseudo.trim();
      if ([...pseudo].length > PSEUDO_MAX_LENGTH) throw new UseCaseError("TROPHY_WITNESS_UNKNOWN");
      const outcome = await ports.trophies.setWitness(pseudo);
      if (outcome === "unknown") throw new UseCaseError("TROPHY_WITNESS_UNKNOWN");
      return outcome;
    },
  };
}
