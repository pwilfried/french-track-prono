import { isValidCompetition, parisToUtc, type CompetitionScope } from "@/domain/competition";
import { ROUNDS, type Round } from "@/domain/rounds";

import { UseCaseError } from "./errors";

type Outcome = "saved" | "not_admin" | "unknown" | "has_predictions";

export type CompetitionFields = {
  name: string;
  scope: CompetitionScope;
  city: string | null;
  countryCode: string | null;
  startsOn: string;
  endsOn: string;
};

/**
 * Port: corrections in the back-office (#293). Real adapter = Supabase (admin session), fake =
 * memory. Something predicted cannot be deleted, nor an event's round changed (`has_predictions`).
 */
export interface CompetitionEditRepository {
  update(slug: string, fields: CompetitionFields): Promise<"saved" | "not_admin" | "unknown">;
  remove(slug: string): Promise<Outcome>;
  updateEvent(
    eventSlug: string,
    change: { round: Round; startsAt: string; lockAt: string },
  ): Promise<Outcome>;
  removeEvent(eventSlug: string): Promise<Outcome>;
}

function check(outcome: Outcome, notFound: "COMPETITION_NOT_FOUND" | "EVENT_NOT_FOUND") {
  if (outcome === "not_admin") throw new UseCaseError("NOT_ADMIN");
  if (outcome === "unknown") throw new UseCaseError(notFound);
  if (outcome === "has_predictions") throw new UseCaseError("HAS_PREDICTIONS");
}

/** The admin corrects a competition: name, kind, place, dates. */
export function editCompetition(ports: { competitions: CompetitionEditRepository }) {
  return {
    async execute(input: {
      slug: string;
      name: string;
      scope: string;
      city: string;
      countryCode: string;
      startsOn: string;
      endsOn: string;
    }): Promise<void> {
      const countryCode = input.countryCode.trim().toUpperCase();
      if (!isValidCompetition(input) || (countryCode && !/^[A-Z]{3}$/.test(countryCode))) {
        throw new UseCaseError("COMPETITION_INVALID");
      }
      check(
        await ports.competitions.update(input.slug, {
          name: input.name.trim(),
          scope: input.scope as CompetitionScope,
          city: input.city.trim() || null,
          countryCode: countryCode || null,
          startsOn: input.startsOn,
          endsOn: input.endsOn,
        }),
        "COMPETITION_NOT_FOUND",
      );
    },
  };
}

/** The admin deletes a competition nobody predicted (a mistake), with its events and entries. */
export function deleteCompetition(ports: { competitions: CompetitionEditRepository }) {
  return {
    async execute(input: { slug: string }): Promise<void> {
      check(await ports.competitions.remove(input.slug), "COMPETITION_NOT_FOUND");
    },
  };
}

/**
 * The admin moves an event (time typed in Paris time, predictions locked `lockMinutes` before)
 * or changes its round, as long as nobody predicted it.
 */
export function editCompetitionEvent(ports: { competitions: CompetitionEditRepository }) {
  return {
    async execute(input: {
      eventSlug: string;
      round: string;
      localStart: string;
      lockMinutes: number;
    }): Promise<void> {
      if (
        !ROUNDS.includes(input.round as Round) ||
        !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(input.localStart) ||
        !Number.isInteger(input.lockMinutes) ||
        input.lockMinutes < 0
      ) {
        throw new UseCaseError("EVENT_INVALID");
      }
      const startsAt = parisToUtc(input.localStart);
      check(
        await ports.competitions.updateEvent(input.eventSlug, {
          round: input.round as Round,
          startsAt,
          lockAt: new Date(Date.parse(startsAt) - input.lockMinutes * 60000).toISOString(),
        }),
        "EVENT_NOT_FOUND",
      );
    },
  };
}

/** The admin deletes an event nobody predicted. */
export function deleteCompetitionEvent(ports: { competitions: CompetitionEditRepository }) {
  return {
    async execute(input: { eventSlug: string }): Promise<void> {
      check(await ports.competitions.removeEvent(input.eventSlug), "EVENT_NOT_FOUND");
    },
  };
}
