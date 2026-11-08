import { describe, expect, it } from "vitest";

import {
  addCompetitionEvent,
  createCompetition,
  setCompetitionAthlete,
  type CompetitionAdminRepository,
} from "./create-competition";
import { UseCaseError } from "./errors";
import { getCompetitionFile, listCompetitions } from "./list-competitions";

function repository(isAdmin = true) {
  const calls: unknown[][] = [];
  const competitions: CompetitionAdminRepository = {
    list: async () => [
      {
        slug: "later",
        name: "Later",
        scope: "france",
        city: null,
        countryCode: null,
        startsOn: "2027-07-01",
        endsOn: "2027-07-02",
        timeZone: "Europe/Paris",
        events: 0,
        finals: 0,
        entered: 0,
      },
      {
        slug: "past",
        name: "Past",
        scope: "international",
        city: null,
        countryCode: null,
        startsOn: "2026-09-12",
        endsOn: "2026-09-13",
        timeZone: "Europe/Budapest",
        events: 28,
        finals: 28,
        entered: 90,
      },
      {
        slug: "soon",
        name: "Soon",
        scope: "france",
        city: null,
        countryCode: null,
        startsOn: "2027-06-25",
        endsOn: "2027-06-27",
        timeZone: "Europe/Paris",
        events: 2,
        finals: 2,
        entered: 8,
      },
    ],
    find: async (slug) =>
      slug === "soon"
        ? {
            slug,
            name: "Soon",
            scope: "france",
            city: null,
            countryCode: null,
            startsOn: "2027-06-25",
            endsOn: "2027-06-27",
            timeZone: "Europe/Paris",
            events: 2,
            finals: 2,
            entered: 2,
            eventList: [
              {
                slug: "b",
                discipline: "200 m",
                gender: "F",
                round: "final",
                startsAt: "2027-06-26T18:00:00.000Z",
                entries: 0,
              },
              {
                slug: "a",
                discipline: "100 m",
                gender: "F",
                round: "final",
                startsAt: "2027-06-25T18:00:00.000Z",
                entries: 0,
              },
            ],
            athletes: [
              { athleteId: "2", slug: "z", name: "Zoé", countryCode: "FRA", gender: "F" },
              { athleteId: "1", slug: "a", name: "Anna", countryCode: "FRA", gender: "F" },
            ],
          }
        : null,
    create: async (c) => {
      calls.push(["create", c]);
      return isAdmin ? c.slug : "not_admin";
    },
    addEvent: async (competition, event) => {
      calls.push(["addEvent", competition, event]);
      return isAdmin ? (competition === "soon" ? event.slug : "unknown") : "not_admin";
    },
    setAthlete: async (competition, athleteId, entered) => {
      calls.push(["setAthlete", competition, athleteId, entered]);
      if (!isAdmin) return "not_admin";
      return athleteId === "busy" ? "in_use" : "saved";
    },
  };
  return { competitions, calls };
}

describe("competitions in the back-office", () => {
  it("lists the coming competitions by start date, then the finished ones", async () => {
    const { coming, past } = await listCompetitions(repository()).execute({ today: "2027-01-10" });

    expect(coming.map((c) => c.slug)).toEqual(["soon", "later"]);
    expect(past.map((c) => c.slug)).toEqual(["past"]);
  });

  it("shows a competition's events in running order and its athletes by name", async () => {
    const file = await getCompetitionFile(repository()).execute({ slug: "soon" });

    expect(file.eventList.map((e) => e.slug)).toEqual(["a", "b"]);
    expect(file.athletes.map((a) => a.name)).toEqual(["Anna", "Zoé"]);
    await expect(getCompetitionFile(repository()).execute({ slug: "nope" })).rejects.toEqual(
      new UseCaseError("COMPETITION_NOT_FOUND"),
    );
  });

  it("creates a French competition with a slug from its name and year", async () => {
    const { competitions, calls } = repository();

    const slug = await createCompetition({ competitions }).execute({
      name: "Championnats de France Élite",
      scope: "france",
      city: " Ville ",
      countryCode: "fra",
      startsOn: "2027-06-25",
      endsOn: "2027-06-27",
      timeZone: "Europe/Paris",
    });

    expect(slug).toBe("championnats-de-france-elite-2027");
    expect(calls[0]).toEqual([
      "create",
      {
        slug: "championnats-de-france-elite-2027",
        name: "Championnats de France Élite",
        scope: "france",
        city: "Ville",
        countryCode: "FRA",
        startsOn: "2027-06-25",
        endsOn: "2027-06-27",
        timeZone: "Europe/Paris",
      },
    ]);
  });

  it("refuses reversed dates and a player", async () => {
    const input = {
      name: "X",
      scope: "france",
      city: "",
      countryCode: "",
      startsOn: "2027-06-25",
      endsOn: "2027-06-27",
      timeZone: "Europe/Paris",
    };

    await expect(
      createCompetition(repository()).execute({ ...input, endsOn: "2027-06-20" }),
    ).rejects.toEqual(new UseCaseError("COMPETITION_INVALID"));
    await expect(createCompetition(repository(false)).execute(input)).rejects.toEqual(
      new UseCaseError("NOT_ADMIN"),
    );
  });

  it("adds a final at 20:35 Paris time, locked 5 minutes before", async () => {
    const { competitions, calls } = repository();

    await addCompetitionEvent({ competitions }).execute({
      competition: "soon",
      timeZone: "Europe/Paris",
      discipline: "100 m",
      gender: "F",
      round: "final",
      localStart: "2027-06-25T20:35",
      lockMinutes: 5,
    });

    expect(calls[0]).toEqual([
      "addEvent",
      "soon",
      {
        slug: "soon-f-100-m",
        discipline: "100 m",
        gender: "F",
        round: "final",
        startsAt: "2027-06-25T18:35:00.000Z",
        lockAt: "2027-06-25T18:30:00.000Z",
      },
    ]);
  });

  it("refuses an event without a time, and an unknown competition", async () => {
    const event = {
      competition: "soon",
      timeZone: "Europe/Paris",
      discipline: "100 m",
      gender: "F",
      round: "final",
      localStart: "",
      lockMinutes: 5,
    };

    await expect(addCompetitionEvent(repository()).execute(event)).rejects.toEqual(
      new UseCaseError("EVENT_INVALID"),
    );
    await expect(
      addCompetitionEvent(repository()).execute({
        ...event,
        competition: "nope",
        localStart: "2027-06-25T20:35",
      }),
    ).rejects.toEqual(new UseCaseError("COMPETITION_NOT_FOUND"));
  });

  it("enters an athlete, and refuses to withdraw one already on a start list", async () => {
    const { competitions, calls } = repository();

    await setCompetitionAthlete({ competitions }).execute({
      competition: "soon",
      athleteId: "1",
      entered: true,
    });
    await expect(
      setCompetitionAthlete({ competitions }).execute({
        competition: "soon",
        athleteId: "busy",
        entered: false,
      }),
    ).rejects.toEqual(new UseCaseError("ATHLETE_ON_START_LIST"));
    expect(calls[0]).toEqual(["setAthlete", "soon", "1", true]);
  });
});
