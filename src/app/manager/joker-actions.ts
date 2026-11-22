"use server";

import { revalidatePath } from "next/cache";

import { UseCaseError, type ErrorCode } from "@/application/errors";
import {
  coachManagerLineup,
  playManagerJoker,
  removeManagerJoker,
  type ManagerJokerRepository,
} from "@/application/manager-jokers";
import { isManagerJoker, type ManagerJoker } from "@/domain/manager-jokers";
import { createSupabaseManagerJokerRepository } from "@/infra";

import { getSessionClient } from "../session";
import { managerPorts } from "./data";

type Matchday = { leagueId: string; competitionId: string; slug: string };

/** Runs a use case of the jokers as the signed-in player; the error code when it is refused. */
async function run(
  input: Matchday,
  action: (ports: { jokers: ManagerJokerRepository }) => Promise<void>,
): Promise<{ error?: ErrorCode }> {
  await managerPorts(`/manager/${input.leagueId}/alignement/${input.slug}`);
  const ports = { jokers: createSupabaseManagerJokerRepository(await getSessionClient()) };
  try {
    await action(ports);
  } catch (error) {
    if (error instanceof UseCaseError) return { error: error.code };
    throw error;
  }
  revalidatePath(`/manager/${input.leagueId}/alignement/${input.slug}`);
  return {};
}

/**
 * Plays a joker on the player's head-to-head of the matchday, with its target, or takes it back
 * (kind null), until the lock (#1091).
 */
export async function playManagerJokerAction(
  input: Matchday & { kind: ManagerJoker | null; athleteId: string | null },
): Promise<{ error?: ErrorCode }> {
  const { leagueId, competitionId, kind } = input;
  if (kind !== null && !isManagerJoker(kind)) return { error: "JOKER_NOT_AVAILABLE" };
  return run(input, (ports) =>
    kind === null
      ? removeManagerJoker(ports).execute({ leagueId, competitionId })
      : playManagerJoker(ports).execute({
          leagueId,
          competitionId,
          kind,
          athleteId: input.athleteId,
        }),
  );
}

/** « Coaching », after the lock: `inId` takes the place of the starter `outId` (#1091). */
export async function coachManagerLineupAction(
  input: Matchday & { outId: string; inId: string },
): Promise<{ error?: ErrorCode }> {
  const { leagueId, competitionId, outId, inId } = input;
  return run(input, (ports) =>
    coachManagerLineup(ports).execute({ leagueId, competitionId, outId, inId }),
  );
}
