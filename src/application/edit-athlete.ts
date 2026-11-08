import type { AthleteRecord } from "@/domain/athlete";
import type { EventGender } from "@/domain/event";

import { UseCaseError } from "./errors";

export type AthleteSummary = {
  athleteId: string;
  slug: string;
  name: string;
  countryCode: string;
  gender: EventGender;
};

/** What the back-office shows of an athlete. */
export type AthleteFile = AthleteSummary & {
  disciplines: { discipline: string; isPrimary: boolean }[];
  records: AthleteRecord[];
};

type Write = Promise<"saved" | "not_admin">;

/** Port: athletes in the back-office. Real adapter = Supabase (admin session), fake = in memory. */
export interface AthleteAdminRepository {
  /** Every athlete, in any order. */
  list(): Promise<AthleteSummary[]>;
  /** One athlete with disciplines and records; null if unknown. */
  find(slug: string): Promise<AthleteFile | null>;
  update(
    athleteId: string,
    fields: { name: string; countryCode: string; gender: EventGender },
  ): Write;
  /** Adds a discipline, or changes whether it is the main one (one main per athlete). */
  setDiscipline(athleteId: string, discipline: string, isPrimary: boolean): Write;
  removeDiscipline(athleteId: string, discipline: string): Write;
  /** Sets a PR or SB; a null mark removes it. */
  setRecord(
    athleteId: string,
    record: {
      discipline: string;
      kind: "pr" | "sb";
      mark: string | null;
      value: number | null;
      date: string | null;
    },
  ): Write;
}

const allowed = async (write: Write) => {
  if ((await write) === "not_admin") throw new UseCaseError("NOT_ADMIN");
};

/** The admin corrects the name, country or gender of an athlete. */
export function editAthlete(ports: { athletes: AthleteAdminRepository }) {
  return {
    async execute(input: { athleteId: string; name: string; countryCode: string; gender: string }) {
      const name = input.name.trim();
      const countryCode = input.countryCode.trim().toUpperCase();
      if (!name || !/^[A-Z]{3}$/.test(countryCode) || !["F", "M", "X"].includes(input.gender)) {
        throw new UseCaseError("ATHLETE_INVALID");
      }
      await allowed(
        ports.athletes.update(input.athleteId, {
          name,
          countryCode,
          gender: input.gender as EventGender,
        }),
      );
    },
  };
}

/** The admin adds a discipline to an athlete, removes it, or makes it the main one. */
export function editAthleteDiscipline(ports: { athletes: AthleteAdminRepository }) {
  return {
    async execute(input: {
      athleteId: string;
      discipline: string;
      action: "add" | "main" | "remove";
    }) {
      if (!input.discipline) throw new UseCaseError("DISCIPLINE_NOT_FOUND");
      await allowed(
        input.action === "remove"
          ? ports.athletes.removeDiscipline(input.athleteId, input.discipline)
          : ports.athletes.setDiscipline(
              input.athleteId,
              input.discipline,
              input.action === "main",
            ),
      );
    },
  };
}
