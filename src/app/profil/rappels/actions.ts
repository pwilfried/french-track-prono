"use server";

import { refresh } from "next/cache";

import type { ErrorCode } from "@/application/errors";
import { UseCaseError } from "@/application/errors";
import { saveReminderSettings } from "@/application/reminder-settings";
import type { ReminderSettings } from "@/domain/reminders";
import { createSupabaseReminderSettingsRepository } from "@/infra";

import { formText, formTexts } from "../../form-data";
import { getSessionClient } from "../../session";

export type ReminderSettingsState = {
  settings: ReminderSettings;
  saved: boolean;
  error: ErrorCode | null;
};

/** The player saves « Mes rappels » (#681); the confirmation shows next to the button. */
export async function saveReminderSettingsAction(
  state: ReminderSettingsState,
  data: FormData,
): Promise<ReminderSettingsState> {
  try {
    const settings = await saveReminderSettings({
      settings: createSupabaseReminderSettingsRepository(await getSessionClient()),
    }).execute({
      families: formTexts(data, "family"),
      lead: formText(data, "lead"),
      quietFrom: formText(data, "quietFrom"),
      quietTo: formText(data, "quietTo"),
    });
    refresh();
    return { settings, saved: true, error: null };
  } catch (error) {
    if (error instanceof UseCaseError) return { ...state, saved: false, error: error.code };
    throw error;
  }
}
