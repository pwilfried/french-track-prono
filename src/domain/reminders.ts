// Smart reminders (#681): grouped pushes the player tunes from « Mes rappels ». These rules are
// the reference; the cron reads them in SQL (private.reminder_due(), migration
// 20261114070000_reminder_settings.sql), tested with the same cases in pgTAP.
import { utcToParis } from "./competition";

/** The families of reminders, each with its own switch. */
export const REMINDER_FAMILIES = [
  "forgotten",
  "eveningResults",
  "manager",
  "league",
  "trashTalk",
  "frenchtrack",
] as const;
export type ReminderFamily = (typeof REMINDER_FAMILIES)[number];

/**
 * The families shown today. « Ma ligue » sends the reactions push (#672, #903), « Chambrage » the
 * trash talk of an evening in a league (#1093); « FrenchTrack » stays hidden until a notification
 * uses it.
 */
export const SHOWN_REMINDER_FAMILIES: readonly ReminderFamily[] = [
  "forgotten",
  "eveningResults",
  "manager",
  "league",
  "trashTalk",
];

/** How long before a lock « Pronos oubliés » may be sent, in minutes. */
export const REMINDER_LEADS = [30, 60, 180] as const;
export type ReminderLead = (typeof REMINDER_LEADS)[number];

export type ReminderSettings = {
  families: Record<ReminderFamily, boolean>;
  leadMinutes: ReminderLead;
  /** Quiet hours, in Paris time: from this hour (included) to that one (excluded). */
  quietFrom: number;
  quietTo: number;
};

/** Every family on, one hour before a lock, quiet from 23 h to 8 h (Paris time). */
export const DEFAULT_REMINDER_SETTINGS: ReminderSettings = {
  families: {
    forgotten: true,
    eveningResults: true,
    manager: true,
    league: true,
    trashTalk: true,
    frenchtrack: true,
  },
  leadMinutes: 60,
  quietFrom: 23,
  quietTo: 8,
};

const isHour = (n: number) => Number.isInteger(n) && n >= 0 && n <= 23;

/**
 * The settings sent by the form, or null when one value is not plausible. A family not sent is
 * off, except the hidden ones, which keep their current value.
 */
export function parseReminderSettings(
  input: { families: string[]; lead: string; quietFrom: string; quietTo: string },
  current: ReminderSettings = DEFAULT_REMINDER_SETTINGS,
): ReminderSettings | null {
  const lead = Number(input.lead);
  const quietFrom = input.quietFrom.trim() === "" ? NaN : Number(input.quietFrom);
  const quietTo = input.quietTo.trim() === "" ? NaN : Number(input.quietTo);
  if (!REMINDER_LEADS.includes(lead as ReminderLead)) return null;
  if (!isHour(quietFrom) || !isHour(quietTo)) return null;
  if (input.families.some((f) => !SHOWN_REMINDER_FAMILIES.includes(f as ReminderFamily))) {
    return null;
  }
  const families = Object.fromEntries(
    REMINDER_FAMILIES.map((f) => [
      f,
      SHOWN_REMINDER_FAMILIES.includes(f) ? input.families.includes(f) : current.families[f],
    ]),
  ) as Record<ReminderFamily, boolean>;
  return { families, leadMinutes: lead as ReminderLead, quietFrom, quietTo };
}

/** Paris time of an instant: the hour (0–23) and the date (YYYY-MM-DD). */
function parisClock(at: Date): { hour: number; date: string } {
  const local = utcToParis(at.toISOString());
  return { hour: Number(local.slice(11, 13)), date: local.slice(0, 10) };
}

/** Within the quiet hours (Paris time)? The same hour twice means no quiet hours. */
export function isQuietTime(at: Date, settings: Pick<ReminderSettings, "quietFrom" | "quietTo">) {
  const { quietFrom: from, quietTo: to } = settings;
  if (from === to) return false;
  const { hour } = parisClock(at);
  return from < to ? hour >= from && hour < to : hour >= from || hour < to;
}

/** The evening of an instant: its date in Paris time. */
export function eveningOf(at: Date): string {
  return parisClock(at).date;
}

/** A final the player has not predicted yet. */
export type ForgottenEvent = { slug: string; label: string; lockAt: Date };

/** A player who may be reminded, with their settings and what they already received. */
export type ReminderCandidate = {
  userId: string;
  settings: ReminderSettings;
  /** Predictable finals without their podium, in a competition they play. */
  missing: ForgottenEvent[];
  /** Evenings already reminded (at most one « Pronos oubliés » per evening). */
  remindedEvenings: string[];
};

/** One « Pronos oubliés » notification: the player, the evening, every final it covers. */
export type ForgottenReminder = { userId: string; evening: string; events: ForgottenEvent[] };

/**
 * Who gets « Pronos oubliés » now: the family on, outside the quiet hours (the window is read
 * again when they end), finals locking within the player's lead time, one message per evening
 * for all of them, and never a second one the same evening.
 */
export function playersToRemind(candidates: ReminderCandidate[], now: Date): ForgottenReminder[] {
  const reminders: ForgottenReminder[] = [];
  for (const c of candidates) {
    if (!c.settings.families.forgotten || isQuietTime(now, c.settings)) continue;
    const until = now.getTime() + c.settings.leadMinutes * 60_000;
    const inWindow = c.missing
      .filter((e) => e.lockAt.getTime() > now.getTime() && e.lockAt.getTime() <= until)
      .sort((a, b) => a.lockAt.getTime() - b.lockAt.getTime() || a.slug.localeCompare(b.slug));
    const byEvening = new Map<string, ForgottenEvent[]>();
    for (const e of inWindow) {
      const evening = eveningOf(e.lockAt);
      if (c.remindedEvenings.includes(evening)) continue;
      byEvening.set(evening, [...(byEvening.get(evening) ?? []), e]);
    }
    const first = [...byEvening][0];
    if (first) reminders.push({ userId: c.userId, evening: first[0], events: first[1] });
  }
  return reminders;
}

/** What one grouped message says: how many finals, which ones, and the first lock. */
export type ForgottenSummary = { count: number; labels: string[]; minutesLeft: number };

/** The finals of a reminder put together in one message. */
export function groupForgotten(events: ForgottenEvent[], now: Date): ForgottenSummary {
  const sorted = [...events].sort((a, b) => a.lockAt.getTime() - b.lockAt.getTime());
  const first = sorted[0]?.lockAt.getTime() ?? now.getTime();
  return {
    count: sorted.length,
    labels: sorted.map((e) => e.label),
    minutesLeft: Math.max(1, Math.round((first - now.getTime()) / 60_000)),
  };
}

/** A final the player predicted on an evening, with their points once computed. */
export type EveningPrediction = { eventSlug: string; points: number | null };

/**
 * « Résultats du soir » is due once every final the player predicted that evening has its points,
 * if the family is on, outside the quiet hours, and not already sent for that evening.
 */
export function isEveningRecapDue(input: {
  settings: ReminderSettings;
  predictions: EveningPrediction[];
  alreadySent: boolean;
  now: Date;
}): boolean {
  const { settings, predictions, alreadySent, now } = input;
  if (!settings.families.eveningResults || alreadySent || isQuietTime(now, settings)) return false;
  return predictions.length > 0 && predictions.every((p) => p.points !== null);
}

/** The points of the evening, summed over its finals. */
export function eveningPoints(predictions: EveningPrediction[]): number {
  return predictions.reduce((sum, p) => sum + (p.points ?? 0), 0);
}
