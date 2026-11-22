// Manager reminders (#836), in the « Manager » family of « Mes rappels » (#681): the end of a
// mercato round in 2 h, a lineup not validated before its lock, a head-to-head over. These rules
// are the reference; the cron reads them in SQL (private.reminder_due(), migration
// 20261114090000_manager_reminders.sql), tested with the same cases in pgTAP. Same quiet hours as
// the other families; each reminder is sent once (league and round, or league and competition).
import { isQuietTime, type ReminderSettings } from "./reminders";

/** How long before the end of a mercato round its reminder may be sent. */
export const MERCATO_ROUND_LEAD_MINUTES = 120;

/** How long after the scores of a competition a head-to-head is still worth telling. */
export const DUEL_OVER_WINDOW_HOURS = 24;

const MINUTE = 60_000;

/** A manager who may be reminded, with their settings and what they already received. */
export type ManagerReminderCandidate = {
  userId: string;
  settings: ReminderSettings;
  /** The keys of the Manager reminders already sent to them (mercatoRoundKey, lineupKey…). */
  sent: string[];
};

const listens = (c: ManagerReminderCandidate, now: Date) =>
  c.settings.families.manager && !isQuietTime(now, c.settings);

/**
 * The open round of a league's mercato, the participants who can still recruit and those who
 * already finished the round (#1084).
 */
export type OpenRound = {
  leagueId: string;
  round: number;
  endsAt: Date;
  recruiters: string[];
  finished: string[];
};

export type MercatoRoundReminder = { userId: string; leagueId: string; round: number };

/** Once per league and round. */
export const mercatoRoundKey = (leagueId: string, round: number) =>
  `mercato_round:${leagueId}:${round}`;

/**
 * Who hears that a mercato round ends in 2 h: the participants who can still recruit and have not
 * finished the round (#1084), the round ending within the next 2 hours, once per round.
 */
export function mercatoRoundReminders(
  candidates: ManagerReminderCandidate[],
  rounds: OpenRound[],
  now: Date,
): MercatoRoundReminder[] {
  const until = now.getTime() + MERCATO_ROUND_LEAD_MINUTES * MINUTE;
  const reminders: MercatoRoundReminder[] = [];
  for (const r of rounds) {
    if (r.endsAt.getTime() <= now.getTime() || r.endsAt.getTime() > until) continue;
    for (const c of candidates) {
      if (!r.recruiters.includes(c.userId) || r.finished.includes(c.userId)) continue;
      if (!listens(c, now)) continue;
      if (c.sent.includes(mercatoRoundKey(r.leagueId, r.round))) continue;
      reminders.push({ userId: c.userId, leagueId: r.leagueId, round: r.round });
    }
  }
  return reminders;
}

/** A matchday of a league, its lineup lock, and who validated their lineup. */
export type MatchdayLock = {
  leagueId: string;
  competitionId: string;
  lockAt: Date;
  members: string[];
  validated: string[];
};

export type LineupReminder = { userId: string; leagueId: string; competitionId: string };

/** Once per league and competition. */
export const lineupKey = (leagueId: string, competitionId: string) =>
  `lineup:${leagueId}:${competitionId}`;

/**
 * Who hears that their lineup is not validated: a participant without a lineup, the lock within
 * their lead time (the « délai avant verrou » of « Mes rappels »), once per matchday.
 */
export function lineupReminders(
  candidates: ManagerReminderCandidate[],
  matchdays: MatchdayLock[],
  now: Date,
): LineupReminder[] {
  const reminders: LineupReminder[] = [];
  for (const m of matchdays) {
    for (const c of candidates) {
      const until = now.getTime() + c.settings.leadMinutes * MINUTE;
      if (m.lockAt.getTime() <= now.getTime() || m.lockAt.getTime() > until) continue;
      if (!m.members.includes(c.userId) || m.validated.includes(c.userId)) continue;
      if (!listens(c, now) || c.sent.includes(lineupKey(m.leagueId, m.competitionId))) continue;
      reminders.push({ userId: c.userId, leagueId: m.leagueId, competitionId: m.competitionId });
    }
  }
  return reminders;
}

/** A head-to-head of a league, with the two Manager scores once its competition is over. */
export type Duel = {
  leagueId: string;
  round: number;
  homeId: string;
  awayId: string;
  /** Every event of the competition finished and its Manager scores computed. */
  over: boolean;
  scoredAt: Date | null;
  homeScore: number;
  awayScore: number;
};

export type DuelReminder = {
  userId: string;
  leagueId: string;
  round: number;
  myScore: number;
  theirScore: number;
  opponentId: string;
};

/** Once per league and round. */
export const duelKey = (leagueId: string, round: number) => `duel_over:${leagueId}:${round}`;

/**
 * Who hears that their head-to-head is over: both players, once the competition is over and
 * scored (within the last 24 hours), once per matchday.
 */
export function duelOverReminders(
  candidates: ManagerReminderCandidate[],
  duels: Duel[],
  now: Date,
): DuelReminder[] {
  const since = now.getTime() - DUEL_OVER_WINDOW_HOURS * 3_600_000;
  const reminders: DuelReminder[] = [];
  for (const d of duels) {
    if (!d.over || !d.scoredAt || d.scoredAt.getTime() <= since) continue;
    const sides = [
      { userId: d.homeId, myScore: d.homeScore, theirScore: d.awayScore, opponentId: d.awayId },
      { userId: d.awayId, myScore: d.awayScore, theirScore: d.homeScore, opponentId: d.homeId },
    ];
    for (const side of sides) {
      const c = candidates.find((x) => x.userId === side.userId);
      if (!c || !listens(c, now) || c.sent.includes(duelKey(d.leagueId, d.round))) continue;
      reminders.push({ ...side, leagueId: d.leagueId, round: d.round });
    }
  }
  return reminders;
}
