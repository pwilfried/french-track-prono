import { compareEvents, type EventSummary } from "@/domain/event";
import {
  countsForFamilies,
  leagueFamilyOf,
  type LeagueFamily,
  type LeagueFamilyRule,
} from "@/domain/league-families";

import type { DisciplineRepository } from "./disciplines";
import type { EventReader } from "./list-events";

/** A final of one of the league's competitions, and whether it counts in the league (#613). */
export type LeagueEvent = EventSummary & {
  competitionSlug: string;
  /** Null when the discipline is unknown. */
  family: LeagueFamily | null;
  counts: boolean;
};

/**
 * The finals of a league's competitions in time order, each telling whether it counts in the
 * league with these families. With `adding`, only the events of that family, as they would count
 * if it were added at `now` (the preview of « Ajouter une famille »).
 */
export function listLeagueEvents(ports: {
  events: EventReader;
  disciplines: DisciplineRepository;
}) {
  return {
    async execute(input: {
      competitionSlugs: string[];
      families: LeagueFamilyRule[];
      adding?: { family: LeagueFamily; now: string };
    }): Promise<LeagueEvent[]> {
      const [disciplines, ...byCompetition] = await Promise.all([
        ports.disciplines.list(),
        ...input.competitionSlugs.map((slug) => ports.events.listByCompetition(slug)),
      ]);
      const familyOf = new Map(disciplines!.map((d) => [d.name, d.family]));
      const rules: LeagueFamilyRule[] = input.adding
        ? [
            ...input.families.filter((r) => r.family !== input.adding!.family),
            { family: input.adding.family, addedAt: input.adding.now },
          ]
        : input.families;
      const events = (byCompetition as EventSummary[][]).flatMap((events, i) =>
        events
          .filter((e) => e.round === "final")
          .map((e): LeagueEvent => {
            const family = familyOf.get(e.discipline);
            return {
              ...e,
              competitionSlug: input.competitionSlugs[i]!,
              family: family ? leagueFamilyOf(family) : null,
              counts: countsForFamilies(rules, { family, startsAt: e.startsAt }),
            };
          }),
      );
      return events
        .filter((e) => !input.adding || e.family === input.adding.family)
        .sort(compareEvents);
    },
  };
}
