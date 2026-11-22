import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * #1070: a change in the back-office must expire what the public pages keep of it. The use cases
 * run as fakes here; what is checked is which public data each action says it changed.
 */
const changed = vi.hoisted(() => vi.fn());
const edited = vi.hoisted(() => vi.fn());

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn(), notFound: vi.fn() }));
vi.mock("../public-data", () => ({ publicDataChanged: changed }));
vi.mock("./guard", () => ({ adminOnly: async () => ({ userId: "admin", client: {} }) }));
vi.mock("@/infra", () => ({
  createSupabaseAthleteAdminRepository: () => ({}),
  createSupabaseDisciplineRepository: () => ({}),
  createSupabaseClubAdminRepository: () => ({}),
  createSupabaseCompetitionAdminRepository: () => ({}),
  createSupabaseCompetitionEditRepository: () => ({}),
  createSupabaseManagerScoreRepository: () => ({}),
}));
const done = () => ({ execute: async (input: unknown) => edited(input) });
vi.mock("@/application/edit-athlete", async (original) => ({
  ...(await original<object>()),
  editAthlete: done,
}));
vi.mock("@/application/club-admin", async (original) => ({
  ...(await original<object>()),
  saveClub: done,
  deleteClub: done,
  validateClub: done,
  mergeClub: () => ({ execute: async () => 2 }),
}));
vi.mock("@/application/edit-competition", async (original) => ({
  ...(await original<object>()),
  editCompetition: done,
}));

const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  return data;
};

beforeEach(() => {
  changed.mockClear();
  edited.mockClear();
});

describe("back-office changes seen by the public pages", () => {
  it("expires the event lists when an athlete's name or country is corrected", async () => {
    const { editAthleteAction } = await import("./athletes/actions");

    await editAthleteAction(form({ slug: "a", athleteId: "1", name: "X", countryCode: "FRA" }));

    expect(changed).toHaveBeenCalledWith("athlete");
  });

  it("expires the rankings when a club is renamed, merged or deleted", async () => {
    const actions = await import("./clubs/actions");

    await actions.updateClubAction("1", { name: "AC Ville", city: "", department: "" });
    await actions.mergeClubAction("1", "2");
    await actions.deleteClubsAction(["1"]);
    await actions.saveClubAction({}, form({ name: "AC Ville" }));

    expect(changed.mock.calls).toEqual([["club"], ["club"], ["club"], ["club"]]);
  });

  it("expires the competitions and events, and moves the events when the admin leaves the box ticked", async () => {
    const { editCompetitionAction } = await import("./competitions/actions");
    const fields = { slug: "m", startsOn: "2027-06-17", previousStartsOn: "2027-06-10" };

    await editCompetitionAction(form({ ...fields, shiftEvents: "1" }));
    await editCompetitionAction(form(fields));

    expect(changed.mock.calls).toEqual([["competition"], ["competition"]]);
    expect(edited.mock.calls.map(([input]) => input.shiftEventsFrom)).toEqual([
      "2027-06-10",
      undefined,
    ]);
  });
});
