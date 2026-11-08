import { parseMark, type Discipline } from "@/domain/discipline";

import type { AthleteAdminRepository } from "./edit-athlete";
import { UseCaseError } from "./errors";

/**
 * The admin types the PR or SB of an athlete in a discipline, in its format ("10.62", "1:56.70",
 * "2.04", "8125"); a blank mark removes it. The date is optional.
 */
export function setAthleteRecord(ports: { athletes: AthleteAdminRepository }) {
  return {
    async execute(input: {
      athleteId: string;
      discipline: Discipline;
      kind: "pr" | "sb";
      mark: string;
      date: string;
    }) {
      const mark = input.mark.trim();
      const date = input.date.trim() || null;
      if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new UseCaseError("DATE_INVALID");
      const value = mark ? parseMark(mark, input.discipline.unit) : null;
      if (mark && value === null) throw new UseCaseError("MARK_INVALID");
      const outcome = await ports.athletes.setRecord(input.athleteId, {
        discipline: input.discipline.name,
        kind: input.kind,
        mark: mark || null,
        value,
        date: mark ? date : null,
      });
      if (outcome === "not_admin") throw new UseCaseError("NOT_ADMIN");
    },
  };
}
