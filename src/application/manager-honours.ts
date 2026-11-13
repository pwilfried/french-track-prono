import type { StandingRow } from "@/domain/manager-championship";
import { seasonReview, type ManagerHonours, type SeasonReview } from "@/domain/manager-honours";

import { UseCaseError } from "./errors";
import {
  participantLookup,
  type ManagerLeagueRepository,
  type ManagerParticipant,
} from "./manager-leagues";

/**
 * Port: the frozen honours of the finished Manager seasons (#434). Real adapter = Supabase (the
 * participants of a league read its honours); fake = in memory. A league still playing, or one
 * the player is not in, has none.
 */
export interface ManagerHonoursRepository {
  find(leagueId: string): Promise<ManagerHonours | null>;
  /** The honours of every finished league of the signed-in player, latest first. */
  mine(): Promise<ManagerHonours[]>;
}

type Ports = {
  managerLeagues: Pick<ManagerLeagueRepository, "find">;
  honours: ManagerHonoursRepository;
  userId: string;
};

/** « Fin de saison » (#434): the final standings, the champion, the player's season. */
export type ManagerSeasonEndView = {
  leagueName: string;
  /** False while the season is still playing: nothing is frozen yet. */
  ended: boolean;
  endedAt: string | null;
  champion: ManagerParticipant | null;
  rows: (StandingRow & { participant: ManagerParticipant; champion: boolean; mine: boolean })[];
  /** Null when the season is not over or the player is not in the standings. */
  review:
    | (Omit<SeasonReview, "rival"> & {
        rival: (NonNullable<SeasonReview["rival"]> & { participant: ManagerParticipant }) | null;
      })
    | null;
};

/** The end of the season of a league, read from its frozen honours. */
export function getManagerSeasonEnd(ports: Ports) {
  return {
    async execute(input: { leagueId: string }): Promise<ManagerSeasonEndView> {
      const league = await ports.managerLeagues.find(input.leagueId);
      if (!league) throw new UseCaseError("LEAGUE_NOT_FOUND");
      const honours = await ports.honours.find(input.leagueId);
      if (!honours) {
        return {
          leagueName: league.name,
          ended: false,
          endedAt: null,
          champion: null,
          rows: [],
          review: null,
        };
      }
      const participant = participantLookup(league.participants);
      const review = seasonReview(ports.userId, honours);
      return {
        leagueName: league.name,
        ended: true,
        endedAt: honours.endedAt,
        champion: honours.championId ? participant(honours.championId) : null,
        rows: honours.standings.map((row) => ({
          ...row,
          participant: participant(row.userId),
          champion: row.userId === honours.championId,
          mine: row.userId === ports.userId,
        })),
        review: review && {
          ...review,
          rival: review.rival && {
            ...review.rival,
            participant: participant(review.rival.userId),
          },
        },
      };
    },
  };
}

/** One finished season in the player's honours (profile). */
export type MyHonour = {
  leagueId: string;
  leagueName: string;
  endedAt: string;
  rank: number;
  players: number;
  champion: boolean;
};

/** The player's honours: every finished Manager season they played, latest first. */
export function getMyManagerHonours(ports: Pick<Ports, "honours" | "userId">) {
  return {
    async execute(): Promise<MyHonour[]> {
      const all = await ports.honours.mine();
      return all
        .flatMap((h) => {
          const review = seasonReview(ports.userId, h);
          return review
            ? [
                {
                  leagueId: h.leagueId,
                  leagueName: h.leagueName,
                  endedAt: h.endedAt,
                  rank: review.rank,
                  players: review.players,
                  champion: review.champion,
                },
              ]
            : [];
        })
        .sort((a, b) => b.endedAt.localeCompare(a.endedAt));
    },
  };
}
