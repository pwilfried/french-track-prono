import type { SupabaseClient } from "@supabase/supabase-js";

import type { PointsRepository, ScoreLine } from "@/application/compute-event-points";
import { UseCaseError } from "@/application/errors";
import type { ScoreReason, ScoringRules } from "@/domain/scoring";

type PredictionRow = { user_id: string; p1: string; p2: string; p3: string; use_joker: boolean };
type ScoreRow = {
  user_id: string;
  event_id: string;
  points: number;
  detail: { reasons?: ScoreReason[] };
};

const RULE_KEYS: Record<string, keyof ScoringRules> = {
  exact_slot: "exactSlot",
  wrong_place: "wrongPlace",
  perfect_podium: "perfectPodium",
  flair_bonus: "flairBonus",
  flair_threshold: "flairThreshold",
  flair_min_players: "flairMinPlayers",
  joker_multiplier: "jokerMultiplier",
};

/** The client must carry the admin's session: row level security decides who can write. */
export function createSupabasePointsRepository(client: SupabaseClient): PointsRepository {
  const fail = (): never => {
    throw new UseCaseError("POINTS_UNAVAILABLE");
  };

  return {
    async loadEvent(eventId) {
      const event = await client.from("events").select("lock_at").eq("id", eventId).maybeSingle<{ lock_at: string }>();
      if (event.error) fail();
      if (!event.data) return null;

      const [results, predictions, rules] = await Promise.all([
        client.from("results").select("athlete_id, rank").eq("event_id", eventId).returns<{ athlete_id: string; rank: number }[]>(),
        client
          .from("predictions")
          .select("user_id, p1, p2, p3, use_joker")
          .eq("event_id", eventId)
          .returns<PredictionRow[]>(),
        client.from("scoring_rules").select("key, value").returns<{ key: string; value: number | string }[]>(),
      ]);
      if (results.error || predictions.error || rules.error) fail();

      const scoring = {} as ScoringRules;
      for (const row of rules.data!) {
        const name = RULE_KEYS[row.key];
        if (name) scoring[name] = Number(row.value);
      }
      if (Object.keys(scoring).length !== Object.keys(RULE_KEYS).length) fail();

      return {
        lockAt: new Date(event.data.lock_at).toISOString(),
        results: results.data!.map((r) => ({ athleteId: r.athlete_id, rank: r.rank })),
        predictions: predictions.data!.map((p) => ({
          userId: p.user_id,
          first: p.p1,
          second: p.p2,
          third: p.p3,
          useJoker: p.use_joker,
        })),
        rules: scoring,
      };
    },

    async findEventScores(eventId) {
      const { data, error } = await client
        .from("score_events")
        .select("user_id, points, detail")
        .eq("event_id", eventId)
        .eq("source", "prediction")
        .returns<ScoreRow[]>();
      if (error) fail();
      return data!.map(
        (row): ScoreLine => ({ userId: row.user_id, points: row.points, reasons: row.detail.reasons ?? [] }),
      );
    },

    async listMine(userId, competitionSlug) {
      const { data, error } = await client
        .from("score_events")
        .select("user_id, event_id, points, detail, events!inner(competitions!inner(slug))")
        .eq("user_id", userId)
        .eq("source", "prediction")
        .eq("events.competitions.slug", competitionSlug)
        .returns<ScoreRow[]>();
      if (error) fail();
      return data!.map((row) => ({
        userId: row.user_id,
        eventId: row.event_id,
        points: row.points,
        reasons: row.detail.reasons ?? [],
      }));
    },

    async replaceEventScores(eventId, lines) {
      const { error } = await client.rpc("set_event_scores", {
        p_event: eventId,
        p_lines: lines.map((l) => ({ user_id: l.userId, points: l.points, detail: { reasons: l.reasons } })),
      });
      if (!error) return "saved";
      // 42501: the session is not an admin's.
      if (error.code === "42501") return "not_admin";
      return fail();
    },
  };
}
