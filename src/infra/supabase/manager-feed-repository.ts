import type { SupabaseClient } from "@supabase/supabase-js";

import { UseCaseError } from "@/application/errors";
import type { ManagerFeedRepository } from "@/application/manager-feed";
import { bibOf } from "@/domain/bib";
import type { DuelSide, ManagerFacts } from "@/domain/manager-moments";

import { momentOf, type FeedRow } from "./league-moment-repository";

type Player = { user_id: string; pseudo: string; bib_number: number; bib_color: string };

type FeedFacts = {
  published: FeedRow[];
  wins: (Player & {
    round: number;
    athlete_id: string;
    athlete: string;
    price: number;
    closed_at: string;
  })[];
  duels: {
    round: number;
    competition_name: string | null;
    scored_at: string;
    home: Player & { score: number };
    away: Player & { score: number };
  }[];
};

const iso = (value: string) => new Date(value).toISOString();

const sideOf = (side: Player & { score: number }): DuelSide => ({
  userId: side.user_id,
  pseudo: side.pseudo,
  bib: bibOf(side.bib_number, side.bib_color),
  score: side.score,
});

/** The client carries the player's session: row level security shows an outsider nothing. */
export function createSupabaseManagerFeedRepository(client: SupabaseClient): ManagerFeedRepository {
  return {
    async facts(leagueId) {
      const { data, error } = await client.rpc("manager_feed", { p_league: leagueId });
      if (error) throw new UseCaseError("LEAGUES_UNAVAILABLE");
      const facts = (data ?? { published: [], wins: [], duels: [] }) as FeedFacts;
      return {
        published: facts.published.flatMap((row) => momentOf(row) ?? []),
        wins: facts.wins.map((w) => ({
          round: w.round,
          athleteId: w.athlete_id,
          athlete: w.athlete,
          price: w.price,
          userId: w.user_id,
          pseudo: w.pseudo,
          bib: bibOf(w.bib_number, w.bib_color),
          closedAt: iso(w.closed_at),
        })),
        duels: facts.duels.map((d) => ({
          round: d.round,
          home: sideOf(d.home),
          away: sideOf(d.away),
          ...(d.competition_name ? { competitionName: d.competition_name } : {}),
          scoredAt: iso(d.scored_at),
        })),
      } satisfies ManagerFacts;
    },
  };
}
