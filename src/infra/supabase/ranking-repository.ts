import type { SupabaseClient } from "@supabase/supabase-js";

import { UseCaseError } from "@/application/errors";
import type { RankingLine, RankingRepository } from "@/application/rankings";
import type { ScoreReason } from "@/domain/scoring";

type Row = {
  user_id: string;
  event_id: string;
  points: number;
  detail: { reasons?: ScoreReason[] };
  profiles: { pseudo: string; avatar_emoji: string };
  events: { starts_at: string };
};

/** Score lines are readable by every signed-in player (the general ranking is public to them). */
export function createSupabaseRankingRepository(client: SupabaseClient): RankingRepository {
  return {
    async competitionLines(competitionSlug) {
      const { data, error } = await client
        .from("score_events")
        .select("user_id, event_id, points, detail, profiles!inner(pseudo, avatar_emoji), events!inner(starts_at, competitions!inner(slug))")
        .eq("events.competitions.slug", competitionSlug)
        .returns<Row[]>();
      if (error) throw new UseCaseError("RANKING_UNAVAILABLE");
      return data.map(
        (row): RankingLine => ({
          userId: row.user_id,
          pseudo: row.profiles.pseudo,
          avatar: row.profiles.avatar_emoji,
          points: row.points,
          reasons: row.detail.reasons ?? [],
          eventId: row.event_id,
          eventStartsAt: new Date(row.events.starts_at).toISOString(),
        }),
      );
    },
  };
}
