import { describe, expect, it } from "vitest";

import { UseCaseError } from "./errors";
import {
  deleteCompetition,
  deleteCompetitionEvent,
  editCompetition,
  editCompetitionEvent,
  type CompetitionEditRepository,
} from "./edit-competition";

type Outcome = "saved" | "not_admin" | "unknown" | "has_predictions";

function repository(outcome: Outcome = "saved") {
  const calls: unknown[][] = [];
  const competitions: CompetitionEditRepository = {
    update: async (...args) => {
      calls.push(["update", ...args]);
      return outcome === "has_predictions" ? "saved" : outcome;
    },
    remove: async (slug) => {
      calls.push(["remove", slug]);
      return outcome;
    },
    updateEvent: async (...args) => {
      calls.push(["updateEvent", ...args]);
      return outcome;
    },
    removeEvent: async (slug) => {
      calls.push(["removeEvent", slug]);
      return outcome;
    },
  };
  return { competitions, calls };
}

const fields = {
  name: " Meeting de Paris ",
  scope: "international",
  city: "Paris",
  countryCode: "fra",
  startsOn: "2027-06-10",
  endsOn: "2027-06-10",
};

const codeOf = (promise: Promise<unknown>) =>
  promise.then(
    () => null,
    (error: unknown) => (error instanceof UseCaseError ? error.code : error),
  );

describe("editCompetition", () => {
  it("lets the admin correct a competition's name, place and dates", async () => {
    const { competitions, calls } = repository();

    await editCompetition({ competitions }).execute({ slug: "meeting", ...fields });

    expect(calls).toEqual([
      [
        "update",
        "meeting",
        {
          name: "Meeting de Paris",
          scope: "international",
          city: "Paris",
          countryCode: "FRA",
          startsOn: "2027-06-10",
          endsOn: "2027-06-10",
        },
      ],
    ]);
  });

  it("refuses dates the wrong way round with COMPETITION_INVALID, an unknown one with COMPETITION_NOT_FOUND", async () => {
    expect(
      await codeOf(
        editCompetition(repository()).execute({ slug: "m", ...fields, endsOn: "2027-06-01" }),
      ),
    ).toBe("COMPETITION_INVALID");
    expect(
      await codeOf(editCompetition(repository("unknown")).execute({ slug: "m", ...fields })),
    ).toBe("COMPETITION_NOT_FOUND");
  });
});

describe("deleteCompetition", () => {
  it("deletes a competition nobody predicted, and refuses one with predictions", async () => {
    const { competitions, calls } = repository();
    await deleteCompetition({ competitions }).execute({ slug: "meeting" });
    expect(calls).toEqual([["remove", "meeting"]]);

    expect(
      await codeOf(deleteCompetition(repository("has_predictions")).execute({ slug: "m" })),
    ).toBe("HAS_PREDICTIONS");
  });
});

describe("editCompetitionEvent", () => {
  it("moves an event to its new local time, locking predictions minutes before", async () => {
    const { competitions, calls } = repository();

    await editCompetitionEvent({ competitions }).execute({
      eventSlug: "meeting-f-100m",
      round: "final",
      localStart: "2027-06-10T20:35",
      lockMinutes: 5,
    });

    expect(calls).toEqual([
      [
        "updateEvent",
        "meeting-f-100m",
        {
          round: "final",
          startsAt: "2027-06-10T18:35:00.000Z",
          lockAt: "2027-06-10T18:30:00.000Z",
        },
      ],
    ]);
  });

  it.each([
    ["a round that does not exist", { round: "relay" }, "EVENT_INVALID"],
    ["a time that is not one", { localStart: "demain" }, "EVENT_INVALID"],
  ])("refuses %s", async (_, change, code) => {
    const input = {
      eventSlug: "e",
      round: "final",
      localStart: "2027-06-10T20:35",
      lockMinutes: 5,
      ...change,
    };
    expect(await codeOf(editCompetitionEvent(repository()).execute(input))).toBe(code);
  });

  it("refuses to change the round of an event already predicted with HAS_PREDICTIONS", async () => {
    expect(
      await codeOf(
        editCompetitionEvent(repository("has_predictions")).execute({
          eventSlug: "e",
          round: "semi",
          localStart: "2027-06-10T20:35",
          lockMinutes: 5,
        }),
      ),
    ).toBe("HAS_PREDICTIONS");
  });
});

describe("deleteCompetitionEvent", () => {
  it("deletes an event nobody predicted; an unknown one gives EVENT_NOT_FOUND", async () => {
    const { competitions, calls } = repository();
    await deleteCompetitionEvent({ competitions }).execute({ eventSlug: "e" });
    expect(calls).toEqual([["removeEvent", "e"]]);
    expect(
      await codeOf(deleteCompetitionEvent(repository("unknown")).execute({ eventSlug: "e" })),
    ).toBe("EVENT_NOT_FOUND");
    expect(
      await codeOf(deleteCompetitionEvent(repository("not_admin")).execute({ eventSlug: "e" })),
    ).toBe("NOT_ADMIN");
  });
});
