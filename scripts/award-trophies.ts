// #1134: the daily draw of the trophies, loaded by scripts/award-trophies.mjs. The same use case
// as the « Attribuer les trophées » button of the back-office, with a client carrying the
// service_role key of the project (an admin for the admin functions).
import type { SupabaseClient } from "@supabase/supabase-js";

import { awardDueTrophies } from "@/application/trophies";
import { competitionDay } from "@/domain/competition";
import { createSupabaseRankingRepository } from "@/infra/supabase/ranking-repository";
import { createSupabaseTrophyRepository } from "@/infra/supabase/trophy-repository";

/** Draws the trophies due today, Paris time; one line of report per season. */
export async function awardTrophies(client: SupabaseClient, now = new Date()): Promise<string[]> {
  const done = await awardDueTrophies({
    trophies: createSupabaseTrophyRepository(client),
    ranking: createSupabaseRankingRepository(client),
    today: () => competitionDay(now.toISOString()),
  }).execute();
  return done.map(
    (d) => `Saison ${d.season} : ${d.awarded} trophée(s), ${d.fresh} nouveau(x) annoncé(s).`,
  );
}
