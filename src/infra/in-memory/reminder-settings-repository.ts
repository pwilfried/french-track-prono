import type { ReminderSettingsRepository } from "@/application/reminder-settings";
import type { ReminderSettings } from "@/domain/reminders";

/** Test double of the ReminderSettingsRepository port: one store, a session per player. */
export function createInMemoryReminderSettingsStore() {
  const rows = new Map<string, ReminderSettings>();
  return {
    session(playerId: string): ReminderSettingsRepository {
      return {
        load: async () => rows.get(playerId) ?? null,
        save: async (settings) => void rows.set(playerId, structuredClone(settings)),
      };
    },
  };
}
