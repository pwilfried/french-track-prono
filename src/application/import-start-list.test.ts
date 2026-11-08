import { describe, expect, it } from "vitest";

import { UseCaseError } from "./errors";
import { importStartList, type ImportEntry } from "./import-start-list";
import type { NewAthlete, StartListEntry, StartListRepository } from "./set-start-list";

function repository(isAdmin = true) {
  const created: NewAthlete[] = [];
  const stored = new Map<string, StartListEntry[]>();
  const startLists: StartListRepository = {
    candidates: async () => [],
    find: async (eventId) => stored.get(eventId) ?? [],
    replace: async (eventId, entries) => {
      if (!isAdmin) return "not_admin";
      stored.set(eventId, entries);
      return "saved";
    },
    createAthlete: async (athlete) => {
      if (!isAdmin) return "not_admin";
      created.push(athlete);
      return { athleteId: `new-${created.length}` };
    },
  };
  return { startLists, created, stored };
}

const codeOf = async (promise: Promise<unknown>) => {
  try {
    await promise;
    return "no error";
  } catch (error) {
    return error instanceof UseCaseError ? error.code : String(error);
  }
};

describe("importStartList", () => {
  it("creates the new athletes, then saves the whole start list with season bests", async () => {
    const { startLists, created, stored } = repository();
    const entries: ImportEntry[] = [
      { athleteId: "a1", seasonBest: "10.71" },
      { newAthlete: { name: "Gémima Joseph", countryCode: "fra" }, seasonBest: null },
    ];

    await importStartList({ startLists }).execute({ eventId: "e1", gender: "F", entries });

    expect(created).toEqual([
      { name: "Gémima Joseph", countryCode: "FRA", gender: "F", slug: "gemima-joseph" },
    ]);
    expect(stored.get("e1")).toEqual([
      { athleteId: "a1", seasonBest: "10.71" },
      { athleteId: "new-1", seasonBest: null },
    ]);
  });

  it("refuses a new athlete without a three-letter country, and creates nobody", async () => {
    const { startLists, created } = repository();

    expect(
      await codeOf(
        importStartList({ startLists }).execute({
          eventId: "e1",
          gender: "F",
          entries: [{ newAthlete: { name: "Sans Pays", countryCode: "" }, seasonBest: null }],
        }),
      ),
    ).toBe("IMPORT_COUNTRY_MISSING");
    expect(created).toEqual([]);
  });

  it("refuses an empty import with START_LIST_INVALID", async () => {
    const { startLists } = repository();

    expect(
      await codeOf(
        importStartList({ startLists }).execute({ eventId: "e1", gender: "F", entries: [] }),
      ),
    ).toBe("START_LIST_INVALID");
  });

  it("refuses a player who is not admin with NOT_ADMIN", async () => {
    const { startLists } = repository(false);

    expect(
      await codeOf(
        importStartList({ startLists }).execute({
          eventId: "e1",
          gender: "F",
          entries: [{ newAthlete: { name: "X", countryCode: "FRA" }, seasonBest: null }],
        }),
      ),
    ).toBe("NOT_ADMIN");
  });
});
