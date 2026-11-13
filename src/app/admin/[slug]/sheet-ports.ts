import type { SupabaseClient } from "@supabase/supabase-js";

import {
  createSupabaseManagerScoreRepository,
  createSupabasePerformanceRepository,
  createSupabasePointsRepository,
} from "@/infra";

/** The ports of the results sheet (#665), all with the admin's own session. */
export function sheetPorts(client: SupabaseClient) {
  return {
    performances: createSupabasePerformanceRepository(client),
    points: createSupabasePointsRepository(client),
    scores: createSupabaseManagerScoreRepository(client),
  };
}
