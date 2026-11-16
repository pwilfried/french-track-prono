import { describe, expect, it } from "vitest";

import { DEFAULT_REMINDER_SETTINGS, type ReminderSettings } from "@/domain/reminders";

import { UseCaseError } from "./errors";
import {
  getReminderSettings,
  type ReminderSettingsRepository,
  saveReminderSettings,
} from "./reminder-settings";

// Application tests do not import the infra layer: a few lines of fake are enough here.
function settingsStore(initial: ReminderSettings | null = null) {
  let saved = initial;
  const settings: ReminderSettingsRepository = {
    load: async () => saved,
    save: async (s) => void (saved = s),
  };
  return { settings, saved: () => saved };
}

describe("reminder settings (#681)", () => {
  it("gives the defaults to a player who never set their reminders", async () => {
    // Given a player who never opened « Mes rappels »
    const store = settingsStore();

    // When they open it
    const settings = await getReminderSettings(store).execute();

    // Then every family is on, one hour before a lock, quiet from 23 h to 8 h
    expect(settings).toEqual(DEFAULT_REMINDER_SETTINGS);
  });

  it("finds the settings again once saved", async () => {
    // Given a player
    const store = settingsStore();

    // When they keep only « Pronos oubliés », three hours before, quiet from 22 h to 9 h
    await saveReminderSettings(store).execute({
      families: ["forgotten"],
      lead: "180",
      quietFrom: "22",
      quietTo: "9",
    });

    // Then they find these settings when they come back
    expect(await getReminderSettings(store).execute()).toEqual({
      families: {
        forgotten: true,
        eveningResults: false,
        manager: false,
        league: false,
        frenchtrack: true,
      },
      leadMinutes: 180,
      quietFrom: 22,
      quietTo: 9,
    });
  });

  it("switches off « Ma ligue », which stops the reactions push, and keeps the rest", async () => {
    // Given a player with the default settings
    const store = settingsStore(DEFAULT_REMINDER_SETTINGS);

    // When they switch off « Ma ligue » only
    await saveReminderSettings(store).execute({
      families: ["forgotten", "eveningResults", "manager"],
      lead: "60",
      quietFrom: "23",
      quietTo: "8",
    });

    // Then « Ma ligue » is off (the cron reads it for reactions), « FrenchTrack » keeps its value
    expect(store.saved()?.families).toEqual({
      ...DEFAULT_REMINDER_SETTINGS.families,
      league: false,
    });
  });

  it("saves nothing when a value is not one of those offered", async () => {
    // Given a player with their settings
    const store = settingsStore(DEFAULT_REMINDER_SETTINGS);

    // When a forged form asks for a 5-minute lead
    const saving = saveReminderSettings(store).execute({
      families: [],
      lead: "5",
      quietFrom: "23",
      quietTo: "8",
    });

    // Then it is refused and nothing changes
    await expect(saving).rejects.toEqual(new UseCaseError("REMINDER_SETTINGS_INVALID"));
    expect(store.saved()).toEqual(DEFAULT_REMINDER_SETTINGS);
  });
});
