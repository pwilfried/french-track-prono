import { describe, expect, it } from "vitest";

import {
  duelKey,
  duelOverReminders,
  lineupKey,
  lineupReminders,
  type ManagerReminderCandidate,
  mercatoRoundKey,
  mercatoRoundReminders,
  type Duel,
  type MatchdayLock,
  type OpenRound,
} from "./manager-reminders";
import { DEFAULT_REMINDER_SETTINGS, type ReminderSettings } from "./reminders";

// November: Paris is UTC+1. 18:00Z is 19:00 in Paris, outside the default quiet hours.
const at = (iso: string) => new Date(iso);
const now = at("2026-11-14T18:00:00Z");
const awake: ReminderSettings = { ...DEFAULT_REMINDER_SETTINGS };

const manager = (
  userId: string,
  change: Partial<ManagerReminderCandidate> = {},
): ManagerReminderCandidate => ({ userId, settings: awake, sent: [], ...change });
const managerOff = (userId: string) =>
  manager(userId, {
    settings: { ...awake, families: { ...awake.families, manager: false } },
  });
const asleep = (userId: string) =>
  manager(userId, { settings: { ...awake, quietFrom: 19, quietTo: 20 } });

describe("mercato round reminders", () => {
  const round = (change: Partial<OpenRound> = {}): OpenRound => ({
    leagueId: "l1",
    round: 2,
    endsAt: at("2026-11-14T19:30:00Z"),
    recruiters: ["u1", "u2"],
    finished: [],
    ...change,
  });

  it("reminds every participant who can still recruit when the round ends within 2 hours", () => {
    expect(mercatoRoundReminders([manager("u1"), manager("u2")], [round()], now)).toEqual([
      { userId: "u1", leagueId: "l1", round: 2 },
      { userId: "u2", leagueId: "l1", round: 2 },
    ]);
  });

  it("says nothing when the round ends later than 2 hours or is already over", () => {
    const later = round({ endsAt: at("2026-11-14T20:01:00Z") });
    const over = round({ endsAt: at("2026-11-14T17:59:00Z") });
    expect(mercatoRoundReminders([manager("u1")], [later, over], now)).toEqual([]);
  });

  it("leaves out a participant who can no longer recruit", () => {
    expect(mercatoRoundReminders([manager("u3")], [round()], now)).toEqual([]);
  });

  it("leaves out a participant who finished the round (#1084)", () => {
    expect(
      mercatoRoundReminders([manager("u1"), manager("u2")], [round({ finished: ["u1"] })], now),
    ).toEqual([{ userId: "u2", leagueId: "l1", round: 2 }]);
  });

  it("sends nothing with the Manager family off, during the quiet hours, nor twice", () => {
    const sent = manager("u1", { sent: [mercatoRoundKey("l1", 2)] });
    expect(mercatoRoundReminders([managerOff("u1"), asleep("u2")], [round()], now)).toEqual([]);
    expect(mercatoRoundReminders([sent], [round()], now)).toEqual([]);
  });
});

describe("lineup reminders", () => {
  const matchday = (change: Partial<MatchdayLock> = {}): MatchdayLock => ({
    leagueId: "l1",
    competitionId: "c1",
    lockAt: at("2026-11-14T18:45:00Z"),
    members: ["u1", "u2"],
    validated: [],
    ...change,
  });

  it("reminds a participant whose lineup is not validated before the lock", () => {
    expect(lineupReminders([manager("u1")], [matchday()], now)).toEqual([
      { userId: "u1", leagueId: "l1", competitionId: "c1" },
    ]);
  });

  it("says nothing to a participant who validated their lineup", () => {
    expect(lineupReminders([manager("u1")], [matchday({ validated: ["u1"] })], now)).toEqual([]);
  });

  it("follows the lead chosen in « Mes rappels »", () => {
    const short = manager("u1", { settings: { ...awake, leadMinutes: 30 } });
    const long = manager("u2", { settings: { ...awake, leadMinutes: 180 } });
    const lock = matchday({ lockAt: at("2026-11-14T19:30:00Z") });
    expect(lineupReminders([short, long], [lock], now)).toEqual([
      { userId: "u2", leagueId: "l1", competitionId: "c1" },
    ]);
  });

  it("says nothing once the lineups are locked, nor to someone outside the league", () => {
    const locked = matchday({ lockAt: at("2026-11-14T17:00:00Z") });
    expect(lineupReminders([manager("u1"), manager("u9")], [locked], now)).toEqual([]);
    expect(lineupReminders([manager("u9")], [matchday()], now)).toEqual([]);
  });

  it("sends nothing with the Manager family off, during the quiet hours, nor twice", () => {
    const sent = manager("u1", { sent: [lineupKey("l1", "c1")] });
    expect(lineupReminders([managerOff("u1"), asleep("u2")], [matchday()], now)).toEqual([]);
    expect(lineupReminders([sent], [matchday()], now)).toEqual([]);
  });
});

describe("duel over reminders", () => {
  const duel = (change: Partial<Duel> = {}): Duel => ({
    leagueId: "l1",
    round: 3,
    homeId: "u1",
    awayId: "u2",
    over: true,
    scoredAt: at("2026-11-14T17:30:00Z"),
    homeScore: 2310,
    awayScore: 1980,
    ...change,
  });

  it("tells both players their head-to-head is over, each from their side", () => {
    expect(duelOverReminders([manager("u1"), manager("u2")], [duel()], now)).toEqual([
      { userId: "u1", leagueId: "l1", round: 3, myScore: 2310, theirScore: 1980, opponentId: "u2" },
      { userId: "u2", leagueId: "l1", round: 3, myScore: 1980, theirScore: 2310, opponentId: "u1" },
    ]);
  });

  it("waits for the competition to be over and scored, and forgets old ones", () => {
    const live = duel({ over: false });
    const unscored = duel({ scoredAt: null });
    const old = duel({ scoredAt: at("2026-11-13T17:59:00Z") });
    expect(duelOverReminders([manager("u1")], [live, unscored, old], now)).toEqual([]);
  });

  it("sends nothing with the Manager family off, during the quiet hours, nor twice", () => {
    const sent = manager("u1", { sent: [duelKey("l1", 3)] });
    expect(duelOverReminders([managerOff("u1"), asleep("u2")], [duel()], now)).toEqual([]);
    expect(duelOverReminders([sent], [duel()], now)).toEqual([]);
  });

  it("does not mistake a mercato round reminder for a duel of the same number", () => {
    const other = manager("u1", { sent: [mercatoRoundKey("l1", 3)] });
    expect(duelOverReminders([other], [duel()], now)).toHaveLength(1);
  });
});
