import type { SupabaseClient } from "@supabase/supabase-js";

import {
  createSupabaseBadgeLevelRepository,
  createSupabasePredictionRepository,
  createSupabaseRankingRepository,
} from "@/infra";

import { publicDisciplines, publicEventReader } from "../public-data";

/** The ports of the badges, for the profile and the action that stores the levels seen. */
export function badgePorts(client: SupabaseClient) {
  return {
    ranking: createSupabaseRankingRepository(client),
    predictions: createSupabasePredictionRepository(client),
    events: publicEventReader(),
    disciplines: publicDisciplines(),
    levels: createSupabaseBadgeLevelRepository(client),
  };
}
