import type { CompetitionScope } from "@/domain/competition";
import { competitionSlug, eventSlug, isValidCompetition, parisToUtc } from "@/domain/competition";
import type { EventGender } from "@/domain/event";
import { ROUNDS, type Round } from "@/domain/rounds";

import { UseCaseError } from "./errors";

export type CompetitionSummary = {
  slug: string;
  name: string;
  scope: CompetitionScope;
  city: string | null;
  countryCode: string | null;
  startsOn: string;
  endsOn: string;
  events: number;
  /** The finals among them: the events players predict. */
  finals: number;
  entered: number;
};

export type CompetitionEvent = {
  slug: string;
  discipline: string;
  gender: EventGender;
  round: Round;
  /** ISO 8601, UTC. */
  startsAt: string;
  entries: number;
};

export type EnteredAthlete = {
  athleteId: string;
  slug: string;
  name: string;
  countryCode: string;
  gender: EventGender;
};

export type CompetitionFile = CompetitionSummary & {
  eventList: CompetitionEvent[];
  athletes: EnteredAthlete[];
};

/** Port: competitions in the back-office. Real adapter = Supabase (admin session), fake = memory. */
export interface CompetitionAdminRepository {
  list(): Promise<CompetitionSummary[]>;
  find(slug: string): Promise<CompetitionFile | null>;
  /** Returns the slug kept (a number is added when taken). */
  create(
    c: Omit<CompetitionSummary, "events" | "finals" | "entered">,
  ): Promise<string | "not_admin">;
  /** Returns the slug kept (a number is added when taken). */
  addEvent(
    competition: string,
    event: {
      slug: string;
      discipline: string;
      gender: EventGender;
      round: Round;
      startsAt: string;
      lockAt: string;
    },
  ): Promise<string | "not_admin" | "unknown">;
  /** Enters or withdraws an athlete; one on a start list cannot be withdrawn (`in_use`). */
  setAthlete(
    competition: string,
    athleteId: string,
    entered: boolean,
  ): Promise<"saved" | "not_admin" | "in_use">;
}

const denied = (outcome: string) => {
  if (outcome === "not_admin") throw new UseCaseError("NOT_ADMIN");
};

/** The admin creates a competition; returns its slug. */
export function createCompetition(ports: { competitions: CompetitionAdminRepository }) {
  return {
    async execute(input: {
      name: string;
      scope: string;
      city: string;
      countryCode: string;
      startsOn: string;
      endsOn: string;
    }): Promise<string> {
      const countryCode = input.countryCode.trim().toUpperCase();
      if (!isValidCompetition(input) || (countryCode && !/^[A-Z]{3}$/.test(countryCode))) {
        throw new UseCaseError("COMPETITION_INVALID");
      }
      const slug = await ports.competitions.create({
        slug: competitionSlug(input.name, input.startsOn),
        name: input.name.trim(),
        scope: input.scope as CompetitionScope,
        city: input.city.trim() || null,
        countryCode: countryCode || null,
        startsOn: input.startsOn,
        endsOn: input.endsOn,
      });
      denied(slug);
      return slug;
    },
  };
}

/**
 * The admin adds an event, its time typed in Paris time whatever the country; predictions lock
 * `lockMinutes` before the start.
 */
export function addCompetitionEvent(ports: { competitions: CompetitionAdminRepository }) {
  return {
    async execute(input: {
      competition: string;
      discipline: string;
      gender: string;
      round: string;
      localStart: string;
      lockMinutes: number;
    }): Promise<string> {
      if (
        !input.discipline ||
        !["F", "M", "X"].includes(input.gender) ||
        !ROUNDS.includes(input.round as Round) ||
        !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(input.localStart) ||
        !Number.isInteger(input.lockMinutes) ||
        input.lockMinutes < 0
      ) {
        throw new UseCaseError("EVENT_INVALID");
      }
      const startsAt = parisToUtc(input.localStart);
      const slug = await ports.competitions.addEvent(input.competition, {
        slug: eventSlug(input.competition, input.gender, input.discipline, input.round),
        discipline: input.discipline,
        gender: input.gender as EventGender,
        round: input.round as Round,
        startsAt,
        lockAt: new Date(Date.parse(startsAt) - input.lockMinutes * 60000).toISOString(),
      });
      denied(slug);
      if (slug === "unknown") throw new UseCaseError("COMPETITION_NOT_FOUND");
      return slug;
    },
  };
}

/** The admin enters an athlete in a competition, or withdraws them. */
export function setCompetitionAthlete(ports: { competitions: CompetitionAdminRepository }) {
  return {
    async execute(input: { competition: string; athleteId: string; entered: boolean }) {
      const outcome = await ports.competitions.setAthlete(
        input.competition,
        input.athleteId,
        input.entered,
      );
      denied(outcome);
      if (outcome === "in_use") throw new UseCaseError("ATHLETE_ON_START_LIST");
    },
  };
}
