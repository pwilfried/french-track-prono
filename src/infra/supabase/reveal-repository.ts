import type { SupabaseClient } from "@supabase/supabase-js";

import { UseCaseError } from "@/application/errors";
import type { RevealedPrediction, RevealRepository } from "@/application/reveal";
import { isReaction } from "@/domain/reveal";

type Row = {
  id: string;
  user_id: string;
  p1: string;
  p2: string;
  p3: string;
  use_joker: boolean;
  profiles: { pseudo: string; avatar_emoji: string };
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
        .select("id, user_id, p1, p2, p3, use_joker, profiles!predictions_user_id_fkey!inner(pseudo, avatar_emoji), reactions(user_id, emoji)")
        .eq("event_id", eventId)
        .returns<Row[]>();
      if (error) throw new UseCaseError("REVEAL_UNAVAILABLE");
      return {
        locked: true,
        predictions: data.map(
          (row): RevealedPrediction => ({
            predictionId: row.id,
            userId: row.user_id,
            pseudo: row.profiles.pseudo,
            avatar: row.profiles.avatar_emoji,
            podium: { first: row.p1, second: row.p2, third: row.p3 },
            useJoker: row.use_joker,
            reactions: row.reactions.flatMap((r) =>
              isReaction(r.emoji) ? [{ userId: r.user_id, reaction: r.emoji }] : [],
            ),
          }),
        ),
      };
    },
  };
}
