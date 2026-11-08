import { describe, expect, it } from "vitest";

import type { EventOdds } from "@/domain/odds";

import { UseCaseError } from "./errors";
import { getEventOdds, setEventOdds, type OddsRepository } from "./set-event-odds";

const startList = ["a", "b", "c", "d", "e", "f"];
const odds: EventOdds = {
  proposed: startList.slice(0, 5).map((athleteId, i) => ({ athleteId, odds: 1.5 + i })),
  other: 8,
};

function repository(outcome: Awaited<ReturnType<OddsRepository["save"]>> = "saved") {
  const saved = new Map<string, EventOdds>();
  const repo: OddsRepository = {
    find: async (eventId) => saved.get(eventId) ?? null,
    marks: async () => [{ athleteId: "a", pr: "10.65", sb: "10.76" }],
    save: async (eventId, o) => {
      if (outcome === "saved") saved.set(eventId, o);
      return outcome;
    },
  };
  return { odds: repo, saved };
}

describe("setEventOdds", () => {
  it("saves odds for five athletes of the start list and another athlete", async () => {
    const ports = repository();

    await setEventOdds(ports).execute({ eventId: "e1", startList, odds });

    expect(ports.saved.get("e1")).toEqual(odds);
    const page = await getEventOdds(ports).execute({ eventId: "e1" });
    expect(page.odds).toEqual(odds);
    expect(page.marks.get("a")).toEqual({ athleteId: "a", pr: "10.65", sb: "10.76" });
  });

  it("refuses an invalid set before saving, locked odds, and a player", async () => {
    const ports = repository();
    await expect(
      setEventOdds(ports).execute({ eventId: "e1", startList, odds: { ...odds, other: 1 } }),
    ).rejects.toEqual(new UseCaseError("ODDS_INVALID"));
    expect(ports.saved.size).toBe(0);

    await expect(
      setEventOdds(repository("locked")).execute({ eventId: "e1", startList, odds }),
    ).rejects.toEqual(new UseCaseError("ODDS_LOCKED"));
    await expect(
      setEventOdds(repository("not_admin")).execute({ eventId: "e1", startList, odds }),
    ).rejects.toEqual(new UseCaseError("NOT_ADMIN"));
  });
});
