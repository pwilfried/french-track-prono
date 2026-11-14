import {
  DEFAULT_REMINDER_SETTINGS,
  parseReminderSettings,
  type ReminderSettings,
} from "@/domain/reminders";

import { UseCaseError } from "./errors";

/** « Mes rappels » (#681). Port: the signed-in player's settings. Real = Supabase, fake = memory. */
export interface ReminderSettingsRepository {
  /** The player's settings, or null when they never saved any. */
  load(): Promise<ReminderSettings | null>;
  save(settings: ReminderSettings): Promise<void>;
}

/** The player's reminder settings, the defaults until they save their own. */
export function getReminderSettings(ports: { settings: ReminderSettingsRepository }) {
  return {
    execute: async (): Promise<ReminderSettings> =>
      (await ports.settings.load()) ?? DEFAULT_REMINDER_SETTINGS,
  };
}

/** The player saves the form of « Mes rappels »; an implausible value saves nothing. */
export function saveReminderSettings(ports: { settings: ReminderSettingsRepository }) {
  return {
    async execute(input: {
      families: string[];
      lead: string;
      quietFrom: string;
      quietTo: string;
    }): Promise<ReminderSettings> {
      const current = (await ports.settings.load()) ?? DEFAULT_REMINDER_SETTINGS;
      const settings = parseReminderSettings(input, current);
      if (!settings) throw new UseCaseError("REMINDER_SETTINGS_INVALID");
      await ports.settings.save(settings);
      return settings;
    },
  };
}
