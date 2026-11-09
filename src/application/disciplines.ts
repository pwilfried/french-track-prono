import { isValidTolerance, type Discipline } from "@/domain/discipline";

import { UseCaseError } from "./errors";

/** Port: disciplines. Real adapter = Supabase, fake = in memory. */
export interface DisciplineRepository {
  /** Every discipline, in any order. */
  list(): Promise<Discipline[]>;
  /** Changes the prediction tolerance of a discipline (admin only). */
  setTolerance(name: string, tolerance: number): Promise<"saved" | "not_admin" | "unknown">;
  /** Adds a discipline (admin only); the name is unique, case ignored (#292). */
  create(discipline: Discipline): Promise<"created" | "not_admin" | "exists">;
}

const FAMILY_ORDER = [
  "sprint",
  "hurdles",
  "middle",
  "long",
  "relay",
  "horizontal_jumps",
  "vertical_jumps",
  "throws",
  "combined",
];

/** The disciplines by family (sprint first, combined events last), then by name. */
export function listDisciplines(ports: { disciplines: DisciplineRepository }) {
  return {
    async execute(): Promise<Discipline[]> {
      const all = await ports.disciplines.list();
      return all.sort(
        (a, b) =>
          FAMILY_ORDER.indexOf(a.family) - FAMILY_ORDER.indexOf(b.family) ||
          a.name.localeCompare(b.name, "fr", { numeric: true }),
      );
    },
  };
}

/** The admin adjusts the tolerance of the performance prediction for a discipline. */
export function setDisciplineTolerance(ports: { disciplines: DisciplineRepository }) {
  return {
    async execute(input: { name: string; tolerance: number }): Promise<void> {
      if (!isValidTolerance(input.tolerance)) throw new UseCaseError("TOLERANCE_INVALID");
      const outcome = await ports.disciplines.setTolerance(input.name, input.tolerance);
      if (outcome === "not_admin") throw new UseCaseError("NOT_ADMIN");
      if (outcome === "unknown") throw new UseCaseError("DISCIPLINE_NOT_FOUND");
    },
  };
}

const FAMILIES: Discipline["family"][] = [
  "sprint",
  "hurdles",
  "middle",
  "long",
  "relay",
  "horizontal_jumps",
  "vertical_jumps",
  "throws",
  "combined",
];
const UNITS: Discipline["unit"][] = ["time", "distance", "points"];

/** The admin adds a discipline: name, family, unit, which way is better, tolerance (#292). */
export function createDiscipline(ports: { disciplines: DisciplineRepository }) {
  return {
    async execute(input: {
      name: string;
      family: string;
      unit: string;
      lowerIsBetter: boolean;
      tolerance: number;
    }): Promise<void> {
      const name = input.name.replace(/\s+/g, " ").trim();
      if (name.length < 2 || name.length > 40) throw new UseCaseError("DISCIPLINE_NAME_INVALID");
      const family = FAMILIES.find((f) => f === input.family);
      const unit = UNITS.find((u) => u === input.unit);
      if (!family || !unit) throw new UseCaseError("DISCIPLINE_NAME_INVALID");
      if (!isValidTolerance(input.tolerance)) throw new UseCaseError("TOLERANCE_INVALID");
      const outcome = await ports.disciplines.create({
        name,
        family,
        unit,
        lowerIsBetter: input.lowerIsBetter,
        tolerance: input.tolerance,
      });
      if (outcome === "not_admin") throw new UseCaseError("NOT_ADMIN");
      if (outcome === "exists") throw new UseCaseError("DISCIPLINE_EXISTS");
    },
  };
}
