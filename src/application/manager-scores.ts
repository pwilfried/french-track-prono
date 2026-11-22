import {
  lineupWithJoker,
  managerDuelJokers,
  type ManagerJokerEffect,
  type ManagerJokerPlay,
} from "@/domain/manager-jokers";
import type { ManagerBonus } from "@/domain/manager-rules";
import {
  managerCompetitionScore,
  type AthleteScore,
  type CompetitionPerformance,
  type ManagerCompetitionScore,
  type ScoringLineup,
  type SubstitutionReason,
} from "@/domain/manager-score";

import type { PerformanceStatus } from "@/domain/performance";

import { UseCaseError } from "./errors";
import type { ManagerCatalogueRepository } from "./manager-catalogue";
import type { ManagerLeagueRepository } from "./manager-leagues";
import type { ManagerLineupRepository } from "./manager-lineup";

/** A participant of a Manager league playing the competition, with their match sheet at the lock. */
export type ScoringParticipant = {
  leagueId: string;
  userId: string;
  /** The bonus values frozen in the league rules. */
  bonuses: Record<ManagerBonus, number>;
  /** The divisor of the table points frozen in the league rules (#1031). */
  tablesDivisor: number;
  /** The match sheet at the lock (#1032); null without a validated lineup. */
  lineup: ScoringLineup | null;
  /** The joker played on the matchday (#1091); absent or null without one. */
  joker?: ManagerJokerPlay | null;
};

/** A head-to-head of a Manager league on the competition (never on a bonus matchday). */
export type ScoringDuel = { leagueId: string; homeId: string; awayId: string };

/** Everything the admin needs to score a competition for every Manager league. */
export type ManagerScoringSheet = {
  competitionId: string;
  /** The lineups lock then: no score before. */
  lockAt: string;
  /** An indoor competition (`venue = 'indoor'`): its races use the short-track tables (#1026). */
  indoor: boolean;
  participants: ScoringParticipant[];
  performances: CompetitionPerformance[];
  /** The head-to-heads of the matchday: the jokers count in them only (#1091). */
  duels?: ScoringDuel[];
};

/** What the jokers of a head-to-head changed in a score (#1091); absent from the scores before. */
export type JokerPart = {
  /** Added to the total of the matchday, negative after a false start. */
  jokers?: number;
  /** The jokers played by the player and against them. */
  jokerEffects?: ManagerJokerEffect[];
};

/**
 * One stored score: a participant of a league, for the competition. `total` counts the jokers:
 * hungarian + bonus + jokers.
 */
export type ManagerScoreLine = ManagerCompetitionScore &
  JokerPart & {
    leagueId: string;
    userId: string;
  };

/** A stored score as the player reads it: the athletes and the targets of the jokers named. */
export type StoredManagerScore = Omit<ManagerCompetitionScore, "athletes"> & {
  athletes: (AthleteScore & { name: string })[];
  jokers?: number;
  jokerEffects?: (ManagerJokerEffect & { name?: string | null })[];
};

/**
 * Port: the Manager scores (#431). Real adapter = Supabase (admin RPCs; a participant reads the
 * scores of their leagues); fake = in memory.
 */
export interface ManagerScoreRepository {
  /** Admin only. Null when the competition does not exist. */
  sheet(competitionSlug: string): Promise<ManagerScoringSheet | null | "not_admin">;
  /** Replaces every Manager score of the competition, in one go. Admin only. */
  replace(competitionId: string, lines: ManagerScoreLine[]): Promise<"saved" | "not_admin">;
  /** The player's own score; null before the first computation. */
  mine(leagueId: string, competitionId: string): Promise<StoredManagerScore | null | "not_member">;
}

/**
 * The Manager score of every participant of every league playing the competition, from the
 * performances entered (the predictions do not count, #1031). Run by every results sheet (#665) and by the
 * admin's « Recalculer »: everything is computed again and replaced (#416).
 */
export function computeManagerScores(ports: { scores: ManagerScoreRepository; now?: () => Date }) {
  const now = ports.now ?? (() => new Date());
  return {
    async execute(input: { competitionSlug: string }): Promise<ManagerScoreLine[]> {
      const sheet = await ports.scores.sheet(input.competitionSlug);
      if (sheet === "not_admin") throw new UseCaseError("NOT_ADMIN");
      if (!sheet) throw new UseCaseError("COMPETITION_NOT_FOUND");
      // No Manager league plays the competition: nothing to score, nothing to store (#665).
      if (sheet.participants.length === 0) return [];
      if (now().getTime() < Date.parse(sheet.lockAt)) {
        throw new UseCaseError("COMPETITION_NOT_STARTED");
      }
      const duels = sheet.duels ?? [];
      const key = (leagueId: string, userId: string) => `${leagueId}|${userId}`;
      const inDuel = new Set(
        duels.flatMap((d) => [key(d.leagueId, d.homeId), key(d.leagueId, d.awayId)]),
      );
      const plays = new Map<string, ManagerJokerPlay | null>();
      const lines = new Map<string, ManagerScoreLine>();
      for (const p of sheet.participants) {
        const k = key(p.leagueId, p.userId);
        // A joker counts in a head-to-head only (never on a bonus matchday).
        const play = inDuel.has(k) ? (p.joker ?? null) : null;
        plays.set(k, play);
        const score = managerCompetitionScore({
          lineup: p.lineup && lineupWithJoker(p.lineup, play),
          performances: sheet.performances,
          indoor: sheet.indoor,
          tablesDivisor: p.tablesDivisor,
          bonuses: p.bonuses,
        });
        lines.set(k, { leagueId: p.leagueId, userId: p.userId, ...score });
      }
      for (const d of duels) {
        const [homeKey, awayKey] = [key(d.leagueId, d.homeId), key(d.leagueId, d.awayId)];
        const home = lines.get(homeKey);
        const away = lines.get(awayKey);
        if (!home || !away) continue;
        const outcome = managerDuelJokers(
          { score: home, play: plays.get(homeKey) ?? null },
          { score: away, play: plays.get(awayKey) ?? null },
        );
        for (const [line, o] of [
          [home, outcome.home],
          [away, outcome.away],
        ] as const) {
          Object.assign(line, { total: o.total, jokers: o.jokers, jokerEffects: o.effects });
        }
      }
      const scored = [...lines.values()];
      const outcome = await ports.scores.replace(sheet.competitionId, scored);
      if (outcome === "not_admin") throw new UseCaseError("NOT_ADMIN");
      return scored;
    },
  };
}

/** A starter who gave way to a substitute (#1036): what they did, and who came in. */
export type ReplacedStarter = {
  athleteId: string;
  name: string;
  reason: SubstitutionReason;
  /** Unknown (nulls) for the scores stored before #1036. */
  mark: string | null;
  status: PerformanceStatus | null;
  substituteName: string;
};

/** « Mes points » for a competition of a Manager league: null score until the admin computes it. */
export type MyManagerScore = {
  slug: string;
  name: string;
  lockAt: string;
  /** The competition the lineup was carried over from (#1034), or null. */
  carriedFrom: string | null;
  /** The table points are divided by it (#1031). */
  divisor: number;
  /** Each athlete who counted; a substitute with the name of the starter they replaced. */
  score:
    | (Omit<StoredManagerScore, "athletes"> & {
        athletes: (StoredManagerScore["athletes"][number] & { starterName?: string })[];
      })
    | null;
  /** « Sur le banc » once scored: the starters replaced, the substitutes who did not come in. */
  bench: { replaced: ReplacedStarter[]; unused: { athleteId: string; name: string }[] };
};

export function getMyManagerScore(ports: {
  lineups: ManagerLineupRepository;
  scores: ManagerScoreRepository;
  catalogue: ManagerCatalogueRepository;
  managerLeagues: Pick<ManagerLeagueRepository, "find">;
}) {
  return {
    async execute(input: { leagueId: string; slug: string }): Promise<MyManagerScore> {
      const [competitions, league] = await Promise.all([
        ports.lineups.mine(input.leagueId),
        ports.managerLeagues.find(input.leagueId),
      ]);
      if (competitions === "not_member" || !league) throw new UseCaseError("LEAGUE_NOT_FOUND");
      const competition = competitions.find((c) => c.slug === input.slug);
      if (!competition) throw new UseCaseError("COMPETITION_NOT_FOUND");
      const score = await ports.scores.mine(input.leagueId, competition.competitionId);
      if (score === "not_member") throw new UseCaseError("LEAGUE_NOT_FOUND");
      const { slug, name, lockAt } = competition;
      const base = {
        slug,
        name,
        lockAt,
        carriedFrom: competition.carriedFrom ?? null,
        divisor: league.rules.tablesDivisor,
      };
      if (!score) return { ...base, score: null, bench: { replaced: [], unused: [] } };

      const [catalogue, saved] = await Promise.all([
        ports.catalogue.list(input.leagueId),
        ports.lineups.sheet(input.leagueId, competition.competitionId),
      ]);
      const names = new Map(
        catalogue === "not_member" ? [] : catalogue.map((a) => [a.athleteId, a.name]),
      );
      const nameOf = (id: string) => names.get(id) ?? "?";
      const athletes = score.athletes.map((a) =>
        a.substitution ? { ...a, starterName: nameOf(a.substitution.starterId) } : a,
      );
      const replaced = score.athletes.flatMap((a): ReplacedStarter[] =>
        a.substitution
          ? [
              {
                athleteId: a.substitution.starterId,
                name: nameOf(a.substitution.starterId),
                reason: a.substitution.reason,
                mark: a.substitution.starter?.mark ?? null,
                status: a.substitution.starter?.status ?? null,
                substituteName: a.name,
              },
            ]
          : [],
      );
      const counted = new Set(score.athletes.map((a) => a.athleteId));
      const bench = typeof saved === "string" || !saved.sheet ? [] : saved.sheet.bench;
      const unused = bench
        .filter((b) => !counted.has(b.athleteId))
        .map((b) => ({ athleteId: b.athleteId, name: nameOf(b.athleteId) }));
      return { ...base, score: { ...score, athletes }, bench: { replaced, unused } };
    },
  };
}
