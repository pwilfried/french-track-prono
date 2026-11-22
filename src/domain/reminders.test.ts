import { describe, expect, it } from "vitest";

import {
  DEFAULT_REMINDER_SETTINGS,
  eveningOf,
  eveningPoints,
  groupForgotten,
  isEveningRecapDue,
  isQuietTime,
  parseReminderSettings,
  playersToRemind,
  SHOWN_REMINDER_FAMILIES,
  type ReminderCandidate,
  type ReminderSettings,
} from "./reminders";

// November: Paris is UTC+1. 18:00Z is 19:00 in Paris.
const at = (iso: string) => new Date(iso);
const now = at("2026-11-14T18:00:00Z");
const final = (slug: string, lockAt: string) => ({ slug, label: slug, lockAt: at(lockAt) });

const settings = (change: Partial<ReminderSettings> = {}): ReminderSettings => ({
  ...DEFAULT_REMINDER_SETTINGS,
  ...change,
});
const candidate = (change: Partial<ReminderCandidate> = {}): ReminderCandidate => ({
  userId: "u1",
  settings: settings(),
  missing: [],
  remindedEvenings: [],
  ...change,
});

describe("reminder settings", () => {
  it("has every family on, one hour before a lock, quiet from 23 h to 8 h by default", () => {
    expect(DEFAULT_REMINDER_SETTINGS).toEqual({
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
    });
  });

  it("reads the form: a shown family not ticked is off, a hidden one keeps its value", () => {
    const current = settings({
      families: { ...DEFAULT_REMINDER_SETTINGS.families, frenchtrack: false },
    });
    expect(
      parseReminderSettings(
        { families: ["forgotten"], lead: "180", quietFrom: "22", quietTo: "7" },
        current,
      ),
    ).toEqual({
      families: {
        forgotten: true,
        eveningResults: false,
        manager: false,
        league: false,
        trashTalk: false,
        frenchtrack: false,
      },
      leadMinutes: 180,
      quietFrom: 22,
      quietTo: 7,
    });
  });

  it("shows « Ma ligue », which sends the reactions push, but keeps « FrenchTrack » hidden", () => {
    expect(SHOWN_REMINDER_FAMILIES).toContain("league");
    expect(SHOWN_REMINDER_FAMILIES).not.toContain("frenchtrack");
  });

  it("shows « Chambrage », on by default (#1093)", () => {
    expect(SHOWN_REMINDER_FAMILIES).toContain("trashTalk");
    expect(DEFAULT_REMINDER_SETTINGS.families.trashTalk).toBe(true);
  });

  it.each([
    { lead: "45", quietFrom: "23", quietTo: "8", families: [] },
    { lead: "60", quietFrom: "24", quietTo: "8", families: [] },
    { lead: "60", quietFrom: "23", quietTo: "", families: [] },
    { lead: "60", quietFrom: "7.5", quietTo: "8", families: [] },
    { lead: "60", quietFrom: "23", quietTo: "8", families: ["frenchtrack"] },
    { lead: "60", quietFrom: "23", quietTo: "8", families: ["spam"] },
  ])("refuses an implausible value: %o", (input) => {
    expect(parseReminderSettings(input)).toBeNull();
  });
});

describe("quiet hours", () => {
  it("are read in Paris time, across midnight", () => {
    const quiet = { quietFrom: 23, quietTo: 8 };
    expect(isQuietTime(at("2026-11-14T21:59:00Z"), quiet)).toBe(false); // 22:59
    expect(isQuietTime(at("2026-11-14T22:00:00Z"), quiet)).toBe(true); // 23:00
    expect(isQuietTime(at("2026-11-15T06:59:00Z"), quiet)).toBe(true); // 07:59
    expect(isQuietTime(at("2026-11-15T07:00:00Z"), quiet)).toBe(false); // 08:00
  });

  it("can sit within one day, or be none at all", () => {
    expect(isQuietTime(at("2026-11-14T12:30:00Z"), { quietFrom: 13, quietTo: 15 })).toBe(true);
    expect(isQuietTime(at("2026-11-14T15:00:00Z"), { quietFrom: 13, quietTo: 15 })).toBe(false);
    expect(isQuietTime(at("2026-11-14T22:30:00Z"), { quietFrom: 0, quietTo: 0 })).toBe(false);
  });

  it("follow summer time", () => {
    // July: Paris is UTC+2, 21:00Z is 23:00 in Paris.
    expect(isQuietTime(at("2026-07-14T21:00:00Z"), { quietFrom: 23, quietTo: 8 })).toBe(true);
  });
});

describe("evening", () => {
  it("is the date in Paris time", () => {
    expect(eveningOf(at("2026-11-14T22:30:00Z"))).toBe("2026-11-14");
    expect(eveningOf(at("2026-11-14T23:30:00Z"))).toBe("2026-11-15");
  });
});

describe("players to remind of forgotten predictions", () => {
  it("reminds a player of every final of the evening locking within their lead, in one message", () => {
    const missing = [
      final("200m-m", "2026-11-14T18:50:00Z"),
      final("100m-f", "2026-11-14T18:20:00Z"),
      final("long-f", "2026-11-14T19:30:00Z"), // after the hour
    ];
    expect(playersToRemind([candidate({ missing })], now)).toEqual([
      { userId: "u1", evening: "2026-11-14", events: [missing[1], missing[0]] },
    ]);
  });

  it("does not remind a player who has posted every podium", () => {
    expect(playersToRemind([candidate({ missing: [] })], now)).toEqual([]);
  });

  it("follows the lead chosen by the player", () => {
    const missing = [final("long-f", "2026-11-14T20:30:00Z")];
    expect(playersToRemind([candidate({ missing })], now)).toEqual([]);
    expect(
      playersToRemind([candidate({ missing, settings: settings({ leadMinutes: 180 }) })], now),
    ).toHaveLength(1);
  });

  it("ignores a final already locked", () => {
    const missing = [final("100m-f", "2026-11-14T18:00:00Z")];
    expect(playersToRemind([candidate({ missing })], now)).toEqual([]);
  });

  it("sends at most one reminder per evening", () => {
    const missing = [final("100m-f", "2026-11-14T18:20:00Z")];
    expect(
      playersToRemind([candidate({ missing, remindedEvenings: ["2026-11-14"] })], now),
    ).toEqual([]);
  });

  it("sends nothing during the quiet hours", () => {
    const late = at("2026-11-14T22:10:00Z"); // 23:10 in Paris
    const missing = [final("marathon", "2026-11-14T22:40:00Z")];
    expect(playersToRemind([candidate({ missing })], late)).toEqual([]);
    expect(
      playersToRemind([candidate({ missing, settings: settings({ quietFrom: 0 }) })], late),
    ).toHaveLength(1);
  });

  it("sends nothing to a player who turned the family off", () => {
    const missing = [final("100m-f", "2026-11-14T18:20:00Z")];
    const off = settings({ families: { ...DEFAULT_REMINDER_SETTINGS.families, forgotten: false } });
    expect(playersToRemind([candidate({ missing, settings: off })], now)).toEqual([]);
  });

  it("keeps each player apart", () => {
    const missing = [final("100m-f", "2026-11-14T18:20:00Z")];
    expect(
      playersToRemind(
        [candidate({ missing }), candidate({ userId: "u2" }), candidate({ userId: "u3", missing })],
        now,
      ).map((r) => r.userId),
    ).toEqual(["u1", "u3"]);
  });
});

describe("grouping into one message", () => {
  it("counts the finals, lists them by lock, and gives the minutes to the first lock", () => {
    expect(
      groupForgotten(
        [
          final("200 m hommes", "2026-11-14T18:50:00Z"),
          final("100 m femmes", "2026-11-14T18:25:00Z"),
        ],
        now,
      ),
    ).toEqual({ count: 2, labels: ["100 m femmes", "200 m hommes"], minutesLeft: 25 });
  });

  it("never says zero minutes", () => {
    expect(groupForgotten([final("100 m", "2026-11-14T18:00:10Z")], now).minutesLeft).toBe(1);
  });
});

describe("evening results", () => {
  const predictions = [
    { eventSlug: "100m-f", points: 9 },
    { eventSlug: "200m-m", points: 0 },
  ];

  it("is due once every final predicted that evening has its points", () => {
    expect(isEveningRecapDue({ settings: settings(), predictions, alreadySent: false, now })).toBe(
      true,
    );
    expect(
      isEveningRecapDue({
        settings: settings(),
        predictions: [...predictions, { eventSlug: "long-f", points: null }],
        alreadySent: false,
        now,
      }),
    ).toBe(false);
  });

  it("is sent once, outside the quiet hours, if the family is on", () => {
    const base = { settings: settings(), predictions, alreadySent: false, now };
    expect(isEveningRecapDue({ ...base, alreadySent: true })).toBe(false);
    expect(isEveningRecapDue({ ...base, now: at("2026-11-14T23:00:00Z") })).toBe(false);
    expect(
      isEveningRecapDue({
        ...base,
        settings: settings({
          families: { ...DEFAULT_REMINDER_SETTINGS.families, eveningResults: false },
        }),
      }),
    ).toBe(false);
    expect(isEveningRecapDue({ ...base, predictions: [] })).toBe(false);
  });

  it("sums the points of the evening", () => {
    expect(eveningPoints(predictions)).toBe(9);
  });
});
