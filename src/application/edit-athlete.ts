import type { AthleteRecord } from "@/domain/athlete";
import type { EventGender } from "@/domain/event";
import { athleteSlug } from "@/domain/start-list-import";

import { UseCaseError } from "./errors";

export type AthleteSummary = {
  athleteId: string;
  slug: string;
  name: string;
  countryCode: string;
  gender: EventGender;
};

/** An athlete of the back-office list, with the names of their disciplines (for the filters). */
export type AthleteListItem = AthleteSummary & { disciplines: string[] };

/** What the back-office shows of an athlete. */
export type AthleteFile = AthleteSummary & {
  disciplines: { discipline: string; isPrimary: boolean }[];
  records: AthleteRecord[];
  /** Price in the French Track Manager catalogue (#421); null keeps them out of it. */
  managerPrice: number | null;
};

type Write = Promise<"saved" | "not_admin">;

/** Port: athletes in the back-office. Real adapter = Supabase (admin session), fake = in memory. */
export interface AthleteAdminRepository {
  /** Every athlete, in any order. */
  list(): Promise<AthleteListItem[]>;
  /** One athlete with disciplines and records; null if unknown. */
  find(slug: string): Promise<AthleteFile | null>;
  update(
    athleteId: string,
    fields: { name: string; countryCode: string; gender: EventGender },
  ): Write;
  /** Adds a new athlete; the slug gets a number if taken. Returns the slug kept. */
  create(fields: {
    name: string;
    countryCode: string;
    gender: EventGender;
    slug: string;
  }): Promise<{ athleteId: string; slug: string } | "not_admin">;
  /** Adds a discipline, or changes whether it is the main one (one main per athlete). */
  setDiscipline(athleteId: string, discipline: string, isPrimary: boolean): Write;
  removeDiscipline(athleteId: string, discipline: string): Write;
  setPrice(athleteId: string, price: number | null): Write;
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

/** Name, country and category as the admin typed them, checked; null when invalid. */
function identity(input: { name: string; countryCode: string; gender: string }) {
  const name = input.name.trim();
  const countryCode = input.countryCode.trim().toUpperCase();
  if (!name || !/^[A-Z]{3}$/.test(countryCode) || !["F", "M", "X"].includes(input.gender)) {
    return null;
  }
  return { name, countryCode, gender: input.gender as EventGender };
}

/** The admin creates an athlete with their main discipline; returns the athlete's slug. */
export function createAthlete(ports: { athletes: AthleteAdminRepository }) {
  return {
    async execute(input: {
      name: string;
      countryCode: string;
      gender: string;
      discipline: string;
    }): Promise<string> {
      const fields = identity(input);
      if (!fields || !athleteSlug(fields.name)) throw new UseCaseError("ATHLETE_INVALID");
      if (!input.discipline) throw new UseCaseError("DISCIPLINE_NOT_FOUND");
      const created = await ports.athletes.create({ ...fields, slug: athleteSlug(fields.name) });
      if (created === "not_admin") throw new UseCaseError("NOT_ADMIN");
      await allowed(ports.athletes.setDiscipline(created.athleteId, input.discipline, true));
      return created.slug;
    },
  };
}

/** The admin corrects the name, country or gender of an athlete. */
export function editAthlete(ports: { athletes: AthleteAdminRepository }) {
  return {
    async execute(input: { athleteId: string; name: string; countryCode: string; gender: string }) {
      const fields = identity(input);
      if (!fields) throw new UseCaseError("ATHLETE_INVALID");
      await allowed(ports.athletes.update(input.athleteId, fields));
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

/** The admin sets the Manager price of an athlete (whole credits); an empty price removes it. */
export function setAthletePrice(ports: { athletes: AthleteAdminRepository }) {
  return {
    async execute(input: { athleteId: string; price: string }) {
      const typed = input.price.trim();
      const price = typed === "" ? null : Number(typed);
      if (price !== null && !(Number.isInteger(price) && price > 0)) {
        throw new UseCaseError("ATHLETE_PRICE_INVALID");
      }
      await allowed(ports.athletes.setPrice(input.athleteId, price));
    },
  };
}
