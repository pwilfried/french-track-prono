import type { DisciplineFamily, MarkUnit } from "@/domain/discipline";
import { isValidOfficialPodium } from "@/domain/official-result";
import {
  outOfRangeMarks,
  performanceProblem,
  podiumFromPerformances,
  tidyPerformances,
  type Performance,
  type PerformanceProblem,
} from "@/domain/performance";

import { computeEventPoints, type PointsRepository, type ScoreLine } from "./compute-event-points";
import type { PerformanceRepository } from "./enter-performances";
import { UseCaseError, type ErrorCode } from "./errors";
import {
  computeManagerScores,
  type ManagerScoreLine,
  type ManagerScoreRepository,
} from "./manager-scores";

type Ports = {
  performances: PerformanceRepository;
  points: PointsRepository;
  scores: ManagerScoreRepository;
  now?: () => Date;
};

/** The event of a results sheet: its competition (null: none) and whether players predicted it. */
export type SheetEvent = {
  eventId: string;
  competitionSlug: string | null;
  /** Players predict finals only: a heat has no prediction points. */
  final: boolean;
};

/** What a computation stored: the prediction points of the event, the Manager scores. */
export type SheetComputation = {
  /** Null for a heat. */
  predictions: ScoreLine[] | null;
  /** Every participant of the Manager leagues playing the competition; empty without any. */
  manager: ManagerScoreLine[];
};

const PROBLEMS: Record<PerformanceProblem, ErrorCode> = {
  twice: "PERFORMANCES_INVALID",
  bad_place: "PERFORMANCES_INVALID",
  not_finished: "PERFORMANCES_INVALID",
  mark_missing: "PERFORMANCE_MARK_MISSING",
  bad_mark: "MARK_INVALID",
};

const OUTCOMES = { not_admin: "NOT_ADMIN", athlete_not_in_event: "ATHLETE_NOT_IN_EVENT" } as const;

/**
 * Everything a results sheet scores, in this order (#665): the prediction points of the event from
 * its podium (the general, league and « Ce soir » rankings read them), then the Manager scores of
 * the competition, which add those prediction points. Each step replaces what it stored before:
 * running it again changes nothing.
 */
export function recomputeResultSheet(ports: Ports) {
  return {
    async execute(event: SheetEvent): Promise<SheetComputation> {
      const predictions = event.final
        ? await computeEventPoints(ports).execute({ eventId: event.eventId })
        : null;
      const manager = event.competitionSlug
        ? await computeManagerScores(ports).execute({ competitionSlug: event.competitionSlug })
        : [];
      return { predictions, manager };
    },
  };
}

/**
 * The admin enters the one results sheet of an event (#665): places, marks and records of its
 * athletes, or DNS, DNF, DQ. The official podium of the predictions is drawn from it (places 1 to
 * 3, ties included), then the predictions and the Manager are scored at once. A corrected sheet
 * replaces the previous one and scores everything again. A mark outside the plausible range of the
 * discipline (#702) is saved only once the admin confirms it.
 */
export function saveResultSheet(ports: Ports) {
  return {
    async execute(
      input: SheetEvent & {
        unit: MarkUnit;
        family?: DisciplineFamily;
        lines: Performance[];
        /** The admin checked the out-of-range marks and saves them anyway. */
        confirmOutOfRange?: boolean;
      },
    ): Promise<SheetComputation & { performances: Performance[] }> {
      const lines = tidyPerformances(input.lines, input.unit);
      const problem = performanceProblem(lines, input.unit);
      if (problem) throw new UseCaseError(PROBLEMS[problem]);
      if (!input.confirmOutOfRange && outOfRangeMarks(lines, input.unit, input.family).length > 0) {
        throw new UseCaseError("MARK_OUT_OF_RANGE_CONFIRM");
      }
      if (!isValidOfficialPodium(podiumFromPerformances(lines))) {
        throw new UseCaseError("RESULT_INVALID");
      }
      const outcome = await ports.performances.replace(input.eventId, lines);
      if (outcome !== "saved") throw new UseCaseError(OUTCOMES[outcome]);
      const computed = await recomputeResultSheet(ports).execute(input);
      return { performances: lines, ...computed };
    },
  };
}
