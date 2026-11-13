import type { DisciplineFamily } from "@/domain/discipline";
import { seasonStats, type SeasonStats } from "@/domain/player-season";
import { rankPlayers, totalsOf } from "@/domain/ranking";

import type { DisciplineRepository } from "./disciplines";
import type { EventReader } from "./list-events";
import type { RankingRepository } from "./rankings";
import type { PredictionRepository } from "./save-prediction";

/** The season of the profile (#384): place in the general ranking and the figures. */
export type MySeason = {
  /** Null before the first point. */
  rank: number | null;
  /** Players in the general ranking. */
  players: number;
  points: number;
  stats: SeasonStats;
};

export function getMySeason(ports: {
  ranking: RankingRepository;
  predictions: PredictionRepository;
  events: EventReader;
  disciplines: DisciplineRepository;
}) {
  return {
    async execute(input: { userId: string; competitionSlugs: string[] }): Promise<MySeason> {
      const disciplines = await ports.disciplines.list();
      // One competition at a time: three reads for each of them at once flooded the API and made
      // one of them fail now and then (the season card's 503).
      const lines = [];
      const predictions = [];
      const events = [];
      for (const slug of input.competitionSlugs) {
        const read = await Promise.all([
          ports.ranking.competitionLines(slug),
          ports.predictions.listForCompetition(input.userId, slug),
          ports.events.listByCompetition(slug),
        ]);
        lines.push(read[0]);
        predictions.push(read[1]);
        events.push(read[2]);
      }
      const all = lines.flat();
      const pseudos = new Map(all.map((l) => [l.userId, l.pseudo]));
      const ranked = rankPlayers(totalsOf(all, (id) => pseudos.get(id) ?? ""));
      const me = ranked.find((p) => p.userId === input.userId);
      const eventOf = new Map(events.flat().map((e) => [e.id, e]));
      const familyOf = new Map<string, DisciplineFamily>(
        disciplines.map((d) => [d.name, d.family]),
      );
      const mine = all
        .filter((l) => l.userId === input.userId && l.eventId !== "")
        .map((l) => {
          const event = eventOf.get(l.eventId);
          return {
            eventId: l.eventId,
            eventStartsAt: l.eventStartsAt,
            points: l.points,
            reasons: l.reasons,
            discipline: event?.discipline ?? "",
            gender: event?.gender ?? ("X" as const),
            family: event ? (familyOf.get(event.discipline) ?? null) : null,
          };
        });
      return {
        rank: me?.rank ?? null,
        players: ranked.length,
        points: me?.points ?? 0,
        stats: seasonStats(mine, predictions.flat().length),
      };
    },
  };
}
