import { isValidTolerance, type Discipline } from "@/domain/discipline";

import { UseCaseError } from "./errors";

/** Port: disciplines. Real adapter = Supabase, fake = in memory. */
export interface DisciplineRepository {
  /** Every discipline, in any order. */
  list(): Promise<Discipline[]>;
  /** Changes the prediction tolerance of a discipline (admin only). */
  setTolerance(name: string, tolerance: number): Promise<"saved" | "not_admin" | "unknown">;
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
