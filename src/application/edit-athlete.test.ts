import { describe, expect, it } from "vitest";

import type { Discipline } from "@/domain/discipline";

import {
  createAthlete,
  editAthlete,
  editAthleteDiscipline,
  type AthleteAdminRepository,
} from "./edit-athlete";
import { UseCaseError } from "./errors";
import { getAthleteFile, listAthletes } from "./list-athletes";
import { setAthleteRecord } from "./set-athlete-record";

function repository(isAdmin = true) {
  const calls: unknown[][] = [];
  const write = async (...args: unknown[]) => {
    calls.push(args);
    return isAdmin ? ("saved" as const) : ("not_admin" as const);
  };
  const athletes: AthleteAdminRepository = {
    list: async () => [
      {
        athleteId: "2",
        slug: "b",
        name: "Sha'Carri Richardson",
        countryCode: "USA",
        gender: "F",
        disciplines: ["100 m"],
      },
      {
        athleteId: "1",
        slug: "a",
        name: "Julien Alfred",
        countryCode: "LCA",
        gender: "F",
        disciplines: ["100 m"],
      },
    ],
    find: async (slug) =>
      slug === "a"
        ? {
            athleteId: "1",
            slug: "a",
            name: "Julien Alfred",
            countryCode: "LCA",
            gender: "F",
            disciplines: [
              { discipline: "200 m", isPrimary: false },
              { discipline: "100 m", isPrimary: true },
            ],
            records: [],
          }
        : null,
    create: async (fields) => {
      calls.push(["create", fields]);
      return isAdmin ? { athleteId: "9", slug: `${fields.slug}-2` } : "not_admin";
    },
    update: (...args) => write("update", ...args),
    setDiscipline: (...args) => write("setDiscipline", ...args),
    removeDiscipline: (...args) => write("removeDiscipline", ...args),
    setRecord: (...args) => write("setRecord", ...args),
  };
  return { athletes, calls };
}

const sprint: Discipline = {
  name: "200 m",
  family: "sprint",
  unit: "time",
  lowerIsBetter: true,
  tolerance: 0.05,
};

describe("athletes in the back-office", () => {
  it("lists athletes by name, and shows the main discipline first", async () => {
    const { athletes } = repository();

    expect((await listAthletes({ athletes }).execute()).map((a) => a.name)).toEqual([
      "Julien Alfred",
      "Sha'Carri Richardson",
    ]);
    expect(
      (await getAthleteFile({ athletes }).execute({ slug: "a" })).disciplines[0]?.discipline,
    ).toBe("100 m");
    await expect(getAthleteFile({ athletes }).execute({ slug: "z" })).rejects.toEqual(
      new UseCaseError("ATHLETE_NOT_FOUND"),
    );
  });

  it("corrects an athlete, with the country in capitals, and refuses a bad country", async () => {
    const { athletes, calls } = repository();

    await editAthlete({ athletes }).execute({
      athleteId: "1",
      name: " Julien Alfred ",
      countryCode: "lca",
      gender: "F",
    });

    expect(calls).toEqual([
      ["update", "1", { name: "Julien Alfred", countryCode: "LCA", gender: "F" }],
    ]);
    await expect(
      editAthlete({ athletes }).execute({
        athleteId: "1",
        name: "X",
        countryCode: "LC",
        gender: "F",
      }),
    ).rejects.toEqual(new UseCaseError("ATHLETE_INVALID"));
  });

  it("adds the 200 m to a 100 m runner, then makes it the main one, then removes it", async () => {
    const { athletes, calls } = repository();
    const useCase = editAthleteDiscipline({ athletes });

    await useCase.execute({ athleteId: "1", discipline: "200 m", action: "add" });
    await useCase.execute({ athleteId: "1", discipline: "200 m", action: "main" });
    await useCase.execute({ athleteId: "1", discipline: "200 m", action: "remove" });

    expect(calls).toEqual([
      ["setDiscipline", "1", "200 m", false],
      ["setDiscipline", "1", "200 m", true],
      ["removeDiscipline", "1", "200 m"],
    ]);
  });

  it("enters a PR read in the discipline's format, and a blank mark removes it", async () => {
    const { athletes, calls } = repository();
    const useCase = setAthleteRecord({ athletes });

    await useCase.execute({
      athleteId: "1",
      discipline: sprint,
      kind: "pr",
      mark: "21.92",
      date: "2023-08-25",
    });
    await useCase.execute({
      athleteId: "1",
      discipline: sprint,
      kind: "sb",
      mark: " ",
      date: "2026-01-01",
    });

    expect(calls).toEqual([
      [
        "setRecord",
        "1",
        { discipline: "200 m", kind: "pr", mark: "21.92", value: 21.92, date: "2023-08-25" },
      ],
      ["setRecord", "1", { discipline: "200 m", kind: "sb", mark: null, value: null, date: null }],
    ]);
  });

  it("refuses a mark that is not a time, a bad date, and a player", async () => {
    await expect(
      setAthleteRecord(repository()).execute({
        athleteId: "1",
        discipline: sprint,
        kind: "pr",
        mark: "2m10",
        date: "",
      }),
    ).rejects.toEqual(new UseCaseError("MARK_INVALID"));
    await expect(
      setAthleteRecord(repository()).execute({
        athleteId: "1",
        discipline: sprint,
        kind: "pr",
        mark: "21.92",
        date: "25/08/2023",
      }),
    ).rejects.toEqual(new UseCaseError("DATE_INVALID"));
    await expect(
      setAthleteRecord(repository(false)).execute({
        athleteId: "1",
        discipline: sprint,
        kind: "pr",
        mark: "21.92",
        date: "",
      }),
    ).rejects.toEqual(new UseCaseError("NOT_ADMIN"));
  });

  it("creates Gémima Joseph with her main discipline and returns her slug", async () => {
    const { athletes, calls } = repository();

    const slug = await createAthlete({ athletes }).execute({
      name: "Gémima Joseph",
      countryCode: "fra",
      gender: "F",
      discipline: "200 m",
    });

    expect(slug).toBe("gemima-joseph-2");
    expect(calls).toEqual([
      ["create", { name: "Gémima Joseph", countryCode: "FRA", gender: "F", slug: "gemima-joseph" }],
      ["setDiscipline", "9", "200 m", true],
    ]);
    await expect(
      createAthlete({ athletes }).execute({
        name: "X",
        countryCode: "FRA",
        gender: "F",
        discipline: "",
      }),
    ).rejects.toEqual(new UseCaseError("DISCIPLINE_NOT_FOUND"));
    await expect(
      createAthlete(repository(false)).execute({
        name: "X",
        countryCode: "FRA",
        gender: "F",
        discipline: "100 m",
      }),
    ).rejects.toEqual(new UseCaseError("NOT_ADMIN"));
  });
});
