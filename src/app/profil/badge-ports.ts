import type { SupabaseClient } from "@supabase/supabase-js";

import { createSupabaseBadgeLevelRepository, createSupabasePredictionRepository } from "@/infra";

import { publicDisciplines, publicEventReader, publicRanking } from "../public-data";

/** The ports of the badges, for the profile and the action that stores the levels seen. */
export function badgePorts(client: SupabaseClient) {
  return {
    ranking: publicRanking(),
    predictions: createSupabasePredictionRepository(client),
    events: publicEventReader(),
    disciplines: publicDisciplines(),
    levels: createSupabaseBadgeLevelRepository(client),
  };
}
