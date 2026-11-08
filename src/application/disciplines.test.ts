import { describe, expect, it } from "vitest";

import type { Discipline } from "@/domain/discipline";

import { listDisciplines, setDisciplineTolerance, type DisciplineRepository } from "./disciplines";
import { UseCaseError } from "./errors";

const discipline = (name: string, family: Discipline["family"], tolerance = 0.05): Discipline => ({
  name,
  family,
  unit: family === "throws" ? "distance" : "time",
  lowerIsBetter: family !== "throws",
  tolerance,
});

function repository(isAdmin = true) {
  const stored = [
    discipline("Javelot", "throws", 0.5),
    discipline("200 m", "sprint"),
    discipline("100 m", "sprint"),
  ];
  const disciplines: DisciplineRepository = {
    list: async () => stored.map((d) => ({ ...d })),
    setTolerance: async (name, tolerance) => {
      if (!isAdmin) return "not_admin";
      const found = stored.find((d) => d.name === name);
      if (!found) return "unknown";
      found.tolerance = tolerance;
      return "saved";
    },
  };
  return { disciplines, stored };
}

describe("listDisciplines", () => {
  it("lists sprints before throws, by name with numbers in order", async () => {
    const list = await listDisciplines(repository()).execute();

    expect(list.map((d) => d.name)).toEqual(["100 m", "200 m", "Javelot"]);
  });
});

describe("setDisciplineTolerance", () => {
  it("lets the admin tighten the 100 m tolerance", async () => {
    const { disciplines, stored } = repository();

    await setDisciplineTolerance({ disciplines }).execute({ name: "100 m", tolerance: 0.03 });

    expect(stored.find((d) => d.name === "100 m")?.tolerance).toBe(0.03);
  });

  it("refuses a tolerance of zero or less, an unknown discipline and a player", async () => {
    await expect(
      setDisciplineTolerance(repository()).execute({ name: "100 m", tolerance: 0 }),
    ).rejects.toEqual(new UseCaseError("TOLERANCE_INVALID"));
    await expect(
      setDisciplineTolerance(repository()).execute({ name: "Course en sac", tolerance: 1 }),
    ).rejects.toEqual(new UseCaseError("DISCIPLINE_NOT_FOUND"));
    await expect(
      setDisciplineTolerance(repository(false)).execute({ name: "100 m", tolerance: 1 }),
    ).rejects.toEqual(new UseCaseError("NOT_ADMIN"));
  });
});
