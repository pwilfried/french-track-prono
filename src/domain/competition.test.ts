import { describe, expect, it } from "vitest";

import {
  daysUntil,
  competitionSlug,
  eventSlug,
  isValidCompetition,
  nextCompetition,
  utcToZoned,
  zonedToUtc,
} from "./competition";

describe("competitionSlug and eventSlug", () => {
  it("builds addresses from the name, the year and the event", () => {
    expect(competitionSlug("Championnats de France Élite", "2027-06-25")).toBe(
      "championnats-de-france-elite-2027",
    );
    expect(eventSlug("cfe-2027", "F", "100 m haies", "final")).toBe("cfe-2027-f-100-m-haies");
    expect(eventSlug("cfe-2027", "M", "400 m", "semi")).toBe("cfe-2027-m-400-m-semi");
  });
});

describe("isValidCompetition", () => {
  const base = {
    name: "Élite",
    scope: "france",
    startsOn: "2027-06-25",
    endsOn: "2027-06-27",
    timeZone: "Europe/Paris",
  };

  it("accepts a named competition whose end is not before its start", () => {
    expect(isValidCompetition(base)).toBe(true);
    expect(isValidCompetition({ ...base, endsOn: "2027-06-25" })).toBe(true);
  });

  it("refuses no name, an unknown type, reversed dates or an unknown time zone", () => {
    expect(isValidCompetition({ ...base, name: " " })).toBe(false);
    expect(isValidCompetition({ ...base, scope: "monde" })).toBe(false);
    expect(isValidCompetition({ ...base, endsOn: "2027-06-24" })).toBe(false);
    expect(isValidCompetition({ ...base, timeZone: "Mars/Olympus" })).toBe(false);
  });
});

describe("zonedToUtc", () => {
  it("reads a local time of the competition as UTC, summer and winter", () => {
    expect(zonedToUtc("2027-06-25T20:35", "Europe/Paris")).toBe("2027-06-25T18:35:00.000Z");
    expect(zonedToUtc("2027-02-20T18:00", "Europe/Paris")).toBe("2027-02-20T17:00:00.000Z");
    expect(zonedToUtc("2027-08-01T21:00", "America/New_York")).toBe("2027-08-02T01:00:00.000Z");
  });
});

describe("nextCompetition", () => {
  const c = (slug: string, startsOn: string, endsOn = startsOn) => ({ slug, startsOn, endsOn });

  it("picks the competition under way or the next to start", () => {
    const list = [
      c("past", "2026-09-01"),
      c("later", "2027-07-01"),
      c("soon", "2027-06-25", "2027-06-27"),
    ];

    expect(nextCompetition(list, "2027-01-10")?.slug).toBe("soon");
    expect(nextCompetition(list, "2027-06-26")?.slug).toBe("soon");
  });

  it("falls back to the latest one when all are over, and to nothing without any", () => {
    expect(nextCompetition([c("a", "2026-01-01"), c("b", "2026-09-01")], "2027-01-10")?.slug).toBe(
      "b",
    );
    expect(nextCompetition([], "2027-01-10")).toBeNull();
  });
});

describe("daysUntil", () => {
  it("counts the days before a competition starts, 0 once it is under way", () => {
    expect(daysUntil("2026-11-20", "2026-11-08")).toBe(12);
    expect(daysUntil("2026-11-08", "2026-11-08")).toBe(0);
    expect(daysUntil("2026-11-01", "2026-11-08")).toBe(0);
  });

  it("is not fooled by a change of daylight saving time", () => {
    expect(daysUntil("2026-03-30", "2026-03-28")).toBe(2);
  });
});

describe("utcToZoned", () => {
  it("gives back the local time typed for an event, in its competition's time zone", () => {
    expect(utcToZoned("2027-06-25T18:35:00.000Z", "Europe/Paris")).toBe("2027-06-25T20:35");
    expect(utcToZoned("2027-01-10T23:30:00.000Z", "Europe/Paris")).toBe("2027-01-11T00:30");
    expect(utcToZoned(zonedToUtc("2027-03-28T03:15", "Europe/Paris"), "Europe/Paris")).toBe(
      "2027-03-28T03:15",
    );
  });
});
