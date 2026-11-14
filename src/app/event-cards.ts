import { listDisciplines } from "@/application/disciplines";
import { UseCaseError } from "@/application/errors";
import { listMyEventMarks } from "@/application/list-my-predictions";
import type { MyEventState } from "@/components/events/event-card";
import type { DisciplineFamily } from "@/domain/discipline";
import {
  createSupabaseAthleteReader,
  createSupabasePointsRepository,
  createSupabasePredictionRepository,
} from "@/infra";

import { publicDisciplines } from "./public-data";
import { getSessionClient } from "./session";

/**
 * The family of each discipline by name, so an event card wears its animal (#800); empty when the
 * disciplines cannot be read (every card then shows the hare).
 */
export async function loadFamilies(): Promise<Map<string, DisciplineFamily>> {
  try {
    const all = await listDisciplines({ disciplines: publicDisciplines() }).execute();
    return new Map(all.map((d) => [d.name, d.family]));
  } catch (error) {
    if (error instanceof UseCaseError) return new Map();
    throw error;
  }
}

/**
 * The signed-in player's predictions in a competition by event id: joker, points won, podium
 * (#800). Throws a UseCaseError when they cannot be read.
 */
export async function loadMyEventStates(
  userId: string,
  competitionSlug: string,
): Promise<Map<string, MyEventState>> {
  const client = await getSessionClient();
  const marks = await listMyEventMarks({
    predictions: createSupabasePredictionRepository(client),
    points: createSupabasePointsRepository(client),
    athletes: createSupabaseAthleteReader(client),
  }).execute({ userId, competitionSlug });
  return new Map<string, MyEventState>(
    marks.map(({ eventId, ...mark }) => [eventId, { predicted: true, ...mark }]),
  );
}
