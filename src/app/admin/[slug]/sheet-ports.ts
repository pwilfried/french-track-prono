import type { SupabaseClient } from "@supabase/supabase-js";

import {
  createSupabaseFrenchTrackRepository,
  createSupabaseManagerScoreRepository,
  createSupabasePerformanceRepository,
  createSupabasePointsRepository,
} from "@/infra";

/**
 * The ports of the results sheet (#665), all with the admin's own session; FrenchTrack's podium
 * is scored with the players' (#674).
 */
export function sheetPorts(client: SupabaseClient) {
  return {
    performances: createSupabasePerformanceRepository(client),
    points: createSupabasePointsRepository(client),
    frenchTrack: createSupabaseFrenchTrackRepository(client),
    scores: createSupabaseManagerScoreRepository(client),
  };
}
