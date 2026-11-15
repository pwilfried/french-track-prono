import type { SupabaseClient } from "@supabase/supabase-js";

import {
  createSupabaseLeagueMomentRepository,
  createSupabaseManagerScoreRepository,
  createSupabasePerformanceRepository,
  createSupabasePointsRepository,
  createSupabaseRankingRepository,
} from "@/infra";

/** The ports of the results sheet (#665), all with the admin's own session. */
export function sheetPorts(client: SupabaseClient) {
  return {
    performances: createSupabasePerformanceRepository(client),
    points: createSupabasePointsRepository(client),
    scores: createSupabaseManagerScoreRepository(client),
    moments: createSupabaseLeagueMomentRepository(client),
    ranking: createSupabaseRankingRepository(client),
  };
}
