import { describe, expect, it } from "vitest";

import { getProgramAlert, type ProgramAlertRepository, setProgramAlert } from "./program-alerts";

// Application tests do not import the infra layer: a few lines of fake are enough here.
function alertsOf(slugs: Set<string>): ProgramAlertRepository {
  return {
    isOn: async (slug) => slugs.has(slug),
    turnOn: async (slug) => void slugs.add(slug),
    turnOff: async (slug) => void slugs.delete(slug),
  };
}

describe("program alerts (#659)", () => {
  it("remembers that a player wants to be told when the programme is out", async () => {
    // Given a player who never asked
    const slugs = new Set<string>();
    const alerts = alertsOf(slugs);
    const isOn = () => getProgramAlert({ alerts }).execute({ competitionSlug: "meeting-paris" });
    expect(await isOn()).toBe(false);

    // When they press « Me prévenir à la publication », twice
    await setProgramAlert({ alerts }).execute({ competitionSlug: "meeting-paris", on: true });
    await setProgramAlert({ alerts }).execute({ competitionSlug: "meeting-paris", on: true });

    // Then the alert is on, for this competition only
    expect(await isOn()).toBe(true);
    expect([...slugs]).toEqual(["meeting-paris"]);
  });

  it("lets a player change their mind", async () => {
    // Given a player whose alert is on
    const alerts = alertsOf(new Set(["meeting-paris"]));

    // When they turn it off
    await setProgramAlert({ alerts }).execute({ competitionSlug: "meeting-paris", on: false });

    // Then it is off
    expect(await getProgramAlert({ alerts }).execute({ competitionSlug: "meeting-paris" })).toBe(
      false,
    );
  });
});
