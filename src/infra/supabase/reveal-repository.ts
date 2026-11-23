import type { SupabaseClient } from "@supabase/supabase-js";

import { UseCaseError } from "@/application/errors";
import type { RevealedPrediction, RevealRepository } from "@/application/reveal";
import { bibOf } from "@/domain/bib";
import type { PredictionScore } from "@/domain/event-result";
import type { JokerPoints } from "@/domain/league-jokers";
import { isReaction } from "@/domain/reveal";
import type { ScoreReason } from "@/domain/scoring";

import { slotFromRow } from "./podium-slot";

type Row = {
  id: string;
  user_id: string;
  p1: string | null;
  p2: string | null;
  p3: string | null;
  profiles: { pseudo: string; bib_number: number; bib_color: string };
  reactions: { user_id: string; emoji: string }[];
};

/** The client carries the player's session: before the lock, row level security hides the others. */
export function createSupabaseRevealRepository(client: SupabaseClient): RevealRepository {
  return {
    async listForEvent(eventId) {
      const event = await client.from("events").select("lock_at").eq("id", eventId).maybeSingle<{ lock_at: string }>();
      if (event.error) throw new UseCaseError("REVEAL_UNAVAILABLE");
      if (!event.data || Date.parse(event.data.lock_at) > Date.now()) return { locked: false, predictions: [] };

      const { data, error } = await client
        .from("predictions")
        .select("id, user_id, p1, p2, p3, profiles!predictions_user_id_fkey!inner(pseudo, bib_number, bib_color), reactions(user_id, emoji)")
        .eq("event_id", eventId)
        .returns<Row[]>();
      if (error) throw new UseCaseError("REVEAL_UNAVAILABLE");
      // The computed points of each prediction, with their reasons (#1155; the rules live in the
      // database, the points are never computed a second time here).
      const scores = await client
        .from("score_events")
        .select("user_id, points, detail")
        .eq("event_id", eventId)
        .eq("source", "prediction")
        .returns<
          {
            user_id: string;
            points: number;
            detail: { reasons?: ScoreReason[]; jokers?: Partial<JokerPoints> };
          }[]
        >();
      if (scores.error) throw new UseCaseError("REVEAL_UNAVAILABLE");
      const scoreOf = new Map(
        scores.data.map((s): [string, PredictionScore] => [
          s.user_id,
          {
            points: s.points,
            reasons: s.detail.reasons ?? [],
            ...(s.detail.jokers ? { jokers: s.detail.jokers } : {}),
          },
        ]),
      );
      return {
        locked: true,
        predictions: data.map(
          (row): RevealedPrediction => ({
            predictionId: row.id,
            userId: row.user_id,
            pseudo: row.profiles.pseudo,
            bib: bibOf(row.profiles.bib_number, row.profiles.bib_color),
            podium: { first: slotFromRow(row.p1), second: slotFromRow(row.p2), third: slotFromRow(row.p3) },
            score: scoreOf.get(row.user_id) ?? null,
            reactions: row.reactions.flatMap((r) =>
              isReaction(r.emoji) ? [{ userId: r.user_id, reaction: r.emoji }] : [],
            ),
          }),
        ),
      };
    },
  };
}
