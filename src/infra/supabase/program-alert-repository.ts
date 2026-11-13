import type { SupabaseClient } from "@supabase/supabase-js";

import { UseCaseError } from "@/application/errors";
import type { ProgramAlertRepository } from "@/application/program-alerts";

/** The client must carry the player's session: a player only reads and writes their own alerts. */
export function createSupabaseProgramAlertRepository(
  client: SupabaseClient,
): ProgramAlertRepository {
  const call = async (fn: string, competitionSlug: string) => {
    const { error } = await client.rpc(fn, { p_competition: competitionSlug });
    if (error) throw new UseCaseError("PROGRAM_ALERT_UNAVAILABLE");
  };
  return {
    async isOn(competitionSlug) {
      // Row level security: only the player's own alerts are read.
      const { data, error } = await client
        .from("program_alerts")
        .select("competition_id, competitions!inner(slug)")
        .eq("competitions.slug", competitionSlug)
        .limit(1);
      if (error) throw new UseCaseError("PROGRAM_ALERT_UNAVAILABLE");
      return data.length > 0;
    },
    turnOn: (competitionSlug) => call("turn_on_program_alert", competitionSlug),
    turnOff: (competitionSlug) => call("turn_off_program_alert", competitionSlug),
  };
}
