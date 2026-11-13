import { describe, expect, it } from "vitest";

import {
  competitionDay,
  competitionVenue,
  competitionsForPlayer,
  rankingStart,
  daysUntil,
  competitionSlug,
  eventSlug,
  isValidCompetition,
  nextCompetition,
  parisToUtc,
  TIME_ZONE,
  utcToParis,
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
  };

  it("accepts a named competition whose end is not before its start", () => {
    expect(isValidCompetition(base)).toBe(true);
    expect(isValidCompetition({ ...base, endsOn: "2027-06-25" })).toBe(true);
  });

  it("refuses no name, an unknown type or reversed dates", () => {
    expect(isValidCompetition({ ...base, name: " " })).toBe(false);
    expect(isValidCompetition({ ...base, scope: "monde" })).toBe(false);
    expect(isValidCompetition({ ...base, endsOn: "2027-06-24" })).toBe(false);
  });

  it("accepts an indoor or outdoor competition, outdoor when none is given, and refuses another venue", () => {
    expect(isValidCompetition({ ...base, venue: "indoor" })).toBe(true);
    expect(isValidCompetition({ ...base, venue: "outdoor" })).toBe(true);
    expect(isValidCompetition({ ...base, venue: "beach" })).toBe(false);
  });
});

describe("competitionVenue", () => {
  it("is outdoor when no venue is given, keeps a known one and has none for an unknown one", () => {
    expect(competitionVenue(undefined)).toBe("outdoor");
    expect(competitionVenue("")).toBe("outdoor");
    expect(competitionVenue("indoor")).toBe("indoor");
    expect(competitionVenue("outdoor")).toBe("outdoor");
    expect(competitionVenue("beach")).toBeNull();
  });
});

describe("TIME_ZONE", () => {
  it("is Paris time, the one time zone of the app", () => {
    expect(TIME_ZONE).toBe("Europe/Paris");
  });
});

describe("parisToUtc", () => {
  it("reads a time typed in Paris time as UTC, summer and winter", () => {
    expect(parisToUtc("2027-06-25T20:35")).toBe("2027-06-25T18:35:00.000Z");
    expect(parisToUtc("2027-02-20T18:00")).toBe("2027-02-20T17:00:00.000Z");
  });

  it("reads Paris time whatever the country of the competition", () => {
    // Birmingham: 20:03 in Paris is 19:03 in London and in UTC in November.
    expect(parisToUtc("2026-11-23T20:03")).toBe("2026-11-23T19:03:00.000Z");
  });

  it("follows the changes of daylight saving time", () => {
    // Summer time starts on 28 March 2027 at 02:00 and ends on 31 October 2027 at 03:00.
    expect(parisToUtc("2027-03-28T01:30")).toBe("2027-03-28T00:30:00.000Z");
    expect(parisToUtc("2027-03-28T03:30")).toBe("2027-03-28T01:30:00.000Z");
    expect(parisToUtc("2027-10-31T01:30")).toBe("2027-10-30T23:30:00.000Z");
    expect(parisToUtc("2027-10-31T04:00")).toBe("2027-10-31T03:00:00.000Z");
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

describe("competitionDay", () => {
  it("is the Paris date of an evening session", () => {
    expect(competitionDay("2026-11-24T19:00:00.000Z")).toBe("2026-11-24");
    expect(competitionDay("2027-06-25T20:35:00.000Z")).toBe("2027-06-25"); // 22:35 in Paris
  });

  it("keeps a final run after midnight in Paris on the evening it belongs to", () => {
    // 01:30 in Paris (UTC+2): a session overseas, still the evening of the 25th.
    expect(competitionDay("2027-06-25T23:30:00.000Z")).toBe("2027-06-25");
    // 05:59 still belongs to the night, 06:00 opens the next day.
    expect(competitionDay(parisToUtc("2027-06-26T05:59"))).toBe("2027-06-25");
    expect(competitionDay(parisToUtc("2027-06-26T06:00"))).toBe("2027-06-26");
  });

  it("uses Paris time, not UTC, in winter too", () => {
    // 23:30 UTC on 10 Jan is 00:30 in Paris on the 11th: still the evening of the 10th.
    expect(competitionDay("2027-01-10T23:30:00.000Z")).toBe("2027-01-10");
    // 05:30 UTC is 06:30 in Paris: the new day has begun.
    expect(competitionDay("2027-01-11T05:30:00.000Z")).toBe("2027-01-11");
  });
});

describe("rankingStart", () => {
  const c = (startsOn: string, endsOn = startsOn) => ({ startsOn, endsOn });

  it("gives the first start and the days left while no competition has started", () => {
    expect(rankingStart([c("2026-12-10"), c("2026-11-20", "2026-11-22")], "2026-11-12")).toEqual({
      startsOn: "2026-11-20",
      days: 8,
    });
  });

  it("is null once a competition has started, or when there is none", () => {
    expect(rankingStart([c("2026-11-12", "2026-11-14"), c("2026-12-10")], "2026-11-12")).toBeNull();
    expect(rankingStart([c("2026-09-11", "2026-09-13")], "2026-11-12")).toBeNull();
    expect(rankingStart([], "2026-11-12")).toBeNull();
  });
});

describe("utcToParis", () => {
  it("gives back the Paris time typed for an event", () => {
    expect(utcToParis("2027-06-25T18:35:00.000Z")).toBe("2027-06-25T20:35");
    expect(utcToParis("2027-01-10T23:30:00.000Z")).toBe("2027-01-11T00:30");
    expect(utcToParis(parisToUtc("2027-03-28T03:15"))).toBe("2027-03-28T03:15");
  });

  it("does not move an instant already stored, only the way it reads", () => {
    // The women's shot put in Birmingham, stored as 19:03 London time, reads 20:03 in Paris.
    expect(utcToParis("2026-11-23T19:03:00.000Z")).toBe("2026-11-23T20:03");
  });
});

describe("competitionsForPlayer", () => {
  const c = (slug: string, startsOn: string, endsOn = startsOn) => ({ slug, startsOn, endsOn });
  const all = [
    c("past", "2026-10-01"),
    c("france", "2026-12-10"),
    c("europe", "2026-11-23", "2026-11-29"),
    c("monde", "2027-03-01"),
    c("live", "2026-11-08", "2026-11-10"),
  ];

  it("puts the coming competitions of my leagues first, each group in date order", () => {
    const { mine, others } = competitionsForPlayer(all, ["monde", "europe", "past"], "2026-11-09");
    expect(mine.map((x) => x.slug)).toEqual(["europe", "monde"]);
    expect(others.map((x) => x.slug)).toEqual(["live", "france"]);
  });

  it("gives every coming competition to a player without league", () => {
    const { mine, others } = competitionsForPlayer(all, [], "2026-11-09");
    expect(mine).toEqual([]);
    expect(others.map((x) => x.slug)).toEqual(["live", "europe", "france", "monde"]);
  });
});
