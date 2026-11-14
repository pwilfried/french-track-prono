import type { SupabaseClient } from "@supabase/supabase-js";

import type { ConsensusRepository } from "@/application/consensus";
import { UseCaseError } from "@/application/errors";

import { slotFromRow } from "./podium-slot";

type Row = { p1: string | null; p2: string | null; p3: string | null; mine: boolean };

/** The client carries the player's session: `event_consensus` refuses before the lock (FT033). */
export function createSupabaseConsensusRepository(client: SupabaseClient): ConsensusRepository {
  return {
    async podiums(eventId, leagueId) {
      const { data, error } = await client.rpc("event_consensus", {
        p_event: eventId,
        p_league: leagueId ?? null,
      });
      if (error?.code === "FT033") throw new UseCaseError("EVENT_NOT_LOCKED");
      if (error?.code === "42501" && leagueId) throw new UseCaseError("LEAGUE_NOT_FOUND");
      if (error) throw new UseCaseError("REVEAL_UNAVAILABLE");
      return ((data ?? []) as Row[]).map((row) => ({
        podium: { first: slotFromRow(row.p1), second: slotFromRow(row.p2), third: slotFromRow(row.p3) },
        mine: row.mine,
      }));
    },
  };
}
