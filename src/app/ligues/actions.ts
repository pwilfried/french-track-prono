"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { UseCaseError, type ErrorCode } from "@/application/errors";
import {
  addLeagueCompetition,
  createLeague,
  joinPublicLeague,
  handOverLeague,
  joinLeague,
  leaveLeague,
  listMyLeagues,
} from "@/application/leagues";
import { normalizeInviteCode } from "@/domain/league";
import { createSupabaseLeagueRepository } from "@/infra";

import { formText } from "../form-data";
import { getCurrentUser, getSessionClient } from "../session";

export type LeagueFormState = { value: string; error?: ErrorCode; isPublic?: boolean };

async function leagues(back: string) {
  const user = await getCurrentUser();
  if (!user) redirect(`/connexion?next=${encodeURIComponent(back)}`);
  return createSupabaseLeagueRepository(await getSessionClient());
}

export async function createLeagueAction(
  _: LeagueFormState,
  data: FormData,
): Promise<LeagueFormState> {
  const value = formText(data, "name");
  const isPublic = formText(data, "public") === "1";
  const competitionSlugs = data
    .getAll("competition")
    .filter((v): v is string => typeof v === "string");
  const back = `/ligues/creer?${new URLSearchParams(competitionSlugs.map((c) => ["competition", c]))}`;
  const repository = await leagues(back);
  let id: string;
  try {
    id = (
      await createLeague({ leagues: repository }).execute({
        name: value,
        competitionSlugs,
        isPublic,
      })
    ).id;
  } catch (error) {
    // Only known error codes are expected here; anything else is a bug and stays visible.
    if (error instanceof UseCaseError) return { value, error: error.code, isPublic };
    throw error;
  }
  redirect(`/ligues/${id}?onglet=inviter&nouvelle=1`);
}

/** Joins with a code; a player already in the league is simply taken to it. */
export async function joinLeagueAction(
  _: LeagueFormState,
  data: FormData,
): Promise<LeagueFormState> {
  const value = formText(data, "code");
  const back = formText(data, "back") || "/ligues/rejoindre";
  const repository = await leagues(back);
  let id: string;
  try {
    id = await joinLeague({ leagues: repository }).execute({ code: value });
  } catch (error) {
    if (!(error instanceof UseCaseError)) throw error;
    if (error.code !== "ALREADY_MEMBER") return { value, error: error.code };
    const code = normalizeInviteCode(value);
    const mine = await listMyLeagues({ leagues: repository }).execute();
    const league = mine.find((l) => l.inviteCode === code);
    if (!league) return { value, error: error.code };
    id = league.id;
  }
  redirect(`/ligues/${id}`);
}

export async function leaveLeagueAction(
  _: LeagueFormState,
  data: FormData,
): Promise<LeagueFormState> {
  const leagueId = formText(data, "leagueId");
  const repository = await leagues(`/ligues/${leagueId}`);
  try {
    await leaveLeague({ leagues: repository }).execute({ leagueId });
  } catch (error) {
    if (error instanceof UseCaseError) return { value: leagueId, error: error.code };
    throw error;
  }
  redirect("/ligues");
}

export async function handOverLeagueAction(
  _: LeagueFormState,
  data: FormData,
): Promise<LeagueFormState> {
  const leagueId = formText(data, "leagueId");
  const newOwnerId = formText(data, "newOwner");
  const repository = await leagues(`/ligues/${leagueId}/confier`);
  try {
    await handOverLeague({ leagues: repository }).execute({ leagueId, newOwnerId });
  } catch (error) {
    if (error instanceof UseCaseError) return { value: newOwnerId, error: error.code };
    throw error;
  }
  redirect(`/ligues/${leagueId}?onglet=membres`);
}

/** The creator adds a coming competition; the league ranking counts it at once. */
export async function addLeagueCompetitionAction(
  _: LeagueFormState,
  data: FormData,
): Promise<LeagueFormState> {
  const leagueId = formText(data, "leagueId");
  const competitionSlug = formText(data, "competition");
  const repository = await leagues(`/ligues/${leagueId}`);
  try {
    await addLeagueCompetition({ leagues: repository }).execute({ leagueId, competitionSlug });
  } catch (error) {
    if (error instanceof UseCaseError) return { value: competitionSlug, error: error.code };
    throw error;
  }
  revalidatePath(`/ligues/${leagueId}`);
  redirect(`/ligues/${leagueId}?ajoutee=1`);
}

/** Joins a public league from the list, then opens it. */
export async function joinPublicLeagueAction(
  _: LeagueFormState,
  data: FormData,
): Promise<LeagueFormState> {
  const leagueId = formText(data, "leagueId");
  const repository = await leagues("/ligues");
  try {
    await joinPublicLeague({ leagues: repository }).execute({ leagueId });
  } catch (error) {
    if (error instanceof UseCaseError) return { value: leagueId, error: error.code };
    throw error;
  }
  redirect(`/ligues/${leagueId}`);
}
