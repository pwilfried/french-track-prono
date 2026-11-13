import { describe, expect, it } from "vitest";

import type { Performance } from "@/domain/performance";

import {
  enterPerformances,
  getPerformanceSheet,
  type PerformanceRepository,
} from "./enter-performances";
import { UseCaseError } from "./errors";

const EVENT = "event-100m";
const START_LIST = ["a1", "a2", "a3"];

/** One event, three athletes on its start list, two of them lined up in Manager leagues. */
function world() {
  const stored = new Map<string, Performance[]>();
  const session = (isAdmin: boolean): PerformanceRepository => ({
    find: async (eventId) => stored.get(eventId) ?? [],
    linedUp: async () => (isAdmin ? ["a3", "a1"] : "not_admin"),
    replace: async (eventId, lines) => {
      if (!isAdmin) return "not_admin";
      if (!lines.every((l) => START_LIST.includes(l.athleteId))) return "athlete_not_in_event";
      stored.set(eventId, lines);
      return "saved";
    },
  });
  return { admin: session(true), player: session(false) };
}

const ok = (athleteId: string, place: number | null, mark: string | null): Performance => ({
  athleteId,
  status: "ok",
  place,
  mark,
  records: [],
});

const codeOf = async (promise: Promise<unknown>) => {
  try {
    await promise;
    return "no error";
  } catch (error) {
    return error instanceof UseCaseError ? error.code : String(error);
  }
};

describe("enterPerformances", () => {
  it("saves places, marks and records of the athletes, then the sheet shows them", async () => {
    // Given an event whose start list has athletes lined up in Manager leagues
    const { admin } = world();

    // When the admin enters a winner with a world record and an athlete who did not finish
    await enterPerformances({ performances: admin }).execute({
      eventId: EVENT,
      unit: "time",
      lines: [
        { ...ok("a1", 1, "9,58"), records: ["wr", "pb", "sb"] },
        { athleteId: "a3", status: "dnf", place: 3, mark: "10.90", records: ["sb"] },
      ],
    });

    // Then the sheet reads the tidied lines and nothing lined up is missing
    const sheet = await getPerformanceSheet({ performances: admin }).execute({ eventId: EVENT });
    expect(sheet.performances).toEqual([
      { ...ok("a1", 1, "9.58"), records: ["pb", "sb", "wr"] },
      { athleteId: "a3", status: "dnf", place: null, mark: null, records: [] },
    ]);
    expect(sheet.linedUp).toEqual(["a3", "a1"]);
    expect(sheet.missing).toEqual([]);
  });

  it("flags the lined-up athletes the admin has not entered yet", async () => {
    const { admin } = world();
    await enterPerformances({ performances: admin }).execute({
      eventId: EVENT,
      unit: "time",
      lines: [ok("a2", 1, "10.62")],
    });

    const sheet = await getPerformanceSheet({ performances: admin }).execute({ eventId: EVENT });

    expect(sheet.missing).toEqual(["a3", "a1"]);
  });

  it("replaces the previous entry when the admin corrects it", async () => {
    const { admin } = world();
    const enter = enterPerformances({ performances: admin });
    await enter.execute({ eventId: EVENT, unit: "time", lines: [ok("a1", 1, "10.62")] });

    await enter.execute({ eventId: EVENT, unit: "time", lines: [ok("a2", 1, "10.70")] });

    const sheet = await getPerformanceSheet({ performances: admin }).execute({ eventId: EVENT });
    expect(sheet.performances).toEqual([ok("a2", 1, "10.70")]);
  });

  it("rejects a finisher without a mark and saves nothing", async () => {
    const { admin } = world();

    expect(
      await codeOf(
        enterPerformances({ performances: admin }).execute({
          eventId: EVENT,
          unit: "time",
          lines: [ok("a1", 1, " ")],
        }),
      ),
    ).toBe("PERFORMANCE_MARK_MISSING");
    expect(await admin.find(EVENT)).toEqual([]);
  });

  it("rejects a mark it cannot read and an athlete entered twice", async () => {
    const enter = enterPerformances({ performances: world().admin });

    expect(
      await codeOf(
        enter.execute({ eventId: EVENT, unit: "distance", lines: [ok("a1", 1, "huit")] }),
      ),
    ).toBe("MARK_INVALID");
    expect(
      await codeOf(
        enter.execute({
          eventId: EVENT,
          unit: "time",
          lines: [ok("a1", 1, "10.62"), ok("a1", 2, "10.70")],
        }),
      ),
    ).toBe("PERFORMANCES_INVALID");
  });

  it("refuses an athlete off the start list and a player who is not admin", async () => {
    const { admin, player } = world();

    expect(
      await codeOf(
        enterPerformances({ performances: admin }).execute({
          eventId: EVENT,
          unit: "time",
          lines: [ok("stranger", 1, "10.62")],
        }),
      ),
    ).toBe("ATHLETE_NOT_IN_EVENT");
    expect(
      await codeOf(
        enterPerformances({ performances: player }).execute({
          eventId: EVENT,
          unit: "time",
          lines: [ok("a1", 1, "10.62")],
        }),
      ),
    ).toBe("NOT_ADMIN");
    expect(
      await codeOf(getPerformanceSheet({ performances: player }).execute({ eventId: EVENT })),
    ).toBe("NOT_ADMIN");
  });
});
