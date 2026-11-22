import type { SupabaseClient } from "@supabase/supabase-js";

import { UseCaseError } from "@/application/errors";
import type { ReminderSettingsRepository } from "@/application/reminder-settings";
import { REMINDER_LEADS, type ReminderLead } from "@/domain/reminders";

/** The client must carry the player's session: a player only reads and writes their own row. */
export function createSupabaseReminderSettingsRepository(
  client: SupabaseClient,
): ReminderSettingsRepository {
  return {
    async load() {
      // Row level security: only the player's own settings are read.
      const { data, error } = await client
        .from("reminder_settings")
        .select(
          "forgotten, evening_results, manager, league, trash_talk, frenchtrack, lead_minutes, quiet_from, quiet_to",
        )
        .maybeSingle();
      if (error) throw new UseCaseError("REMINDER_SETTINGS_UNAVAILABLE");
      if (!data) return null;
      const lead = REMINDER_LEADS.includes(data.lead_minutes) ? data.lead_minutes : 60;
      return {
        families: {
          forgotten: data.forgotten,
          eveningResults: data.evening_results,
          manager: data.manager,
          league: data.league,
          trashTalk: data.trash_talk,
          frenchtrack: data.frenchtrack,
        },
        leadMinutes: lead as ReminderLead,
        quietFrom: data.quiet_from,
        quietTo: data.quiet_to,
      };
    },
    async save(settings) {
      const { error } = await client.rpc("save_reminder_settings", {
        p_forgotten: settings.families.forgotten,
        p_evening_results: settings.families.eveningResults,
        p_manager: settings.families.manager,
        p_league: settings.families.league,
        p_trash_talk: settings.families.trashTalk,
        p_frenchtrack: settings.families.frenchtrack,
        p_lead_minutes: settings.leadMinutes,
        p_quiet_from: settings.quietFrom,
        p_quiet_to: settings.quietTo,
      });
      if (error) throw new UseCaseError("REMINDER_SETTINGS_UNAVAILABLE");
    },
  };
}
