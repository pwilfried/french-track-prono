import type { LeagueFamilyRule } from "@/domain/league-families";
import { leaguePredict, type LeaguePredict } from "@/domain/league-predict";

import type { LeagueEvent } from "./league-events";

import type { DisciplineRepository } from "./disciplines";
import { listLeagueEvents } from "./league-events";
import type { EventReader } from "./list-events";
import type { PredictionRepository } from "./save-prediction";

/**
 * The « Pronostiquer » block of a league (#1069): the next finals counting in the league that the
 * player has left to predict, else « all posed », else the league's next competition.
 */
export function getLeaguePredict(ports: {
  events: EventReader;
  disciplines: DisciplineRepository;
  predictions: Pick<PredictionRepository, "listForCompetition">;
}) {
  return {
    async execute<C extends { slug: string; startsOn: string }>(input: {
      userId: string;
      competitionSlugs: string[];
      families: LeagueFamilyRule[];
      /** The competitions to come; only those of the league are kept. */
      competitions: C[];
      now: Date;
    }): Promise<LeaguePredict<LeagueEvent, C> | null> {
      const [events, predictions] = await Promise.all([
        listLeagueEvents(ports).execute({
          competitionSlugs: input.competitionSlugs,
          families: input.families,
        }),
        Promise.all(
          input.competitionSlugs.map((slug) =>
            ports.predictions.listForCompetition(input.userId, slug),
          ),
        ),
      ]);
      return leaguePredict({
        events: events.filter((e) => e.counts),
        predicted: new Set(predictions.flat().map((p) => p.eventId)),
        competitions: input.competitions.filter((c) => input.competitionSlugs.includes(c.slug)),
        now: input.now,
      });
    },
  };
}
