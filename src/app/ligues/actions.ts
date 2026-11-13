"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { UseCaseError, type ErrorCode } from "@/application/errors";
import {
  addLeagueCompetition,
  addLeagueFamily,
  createLeague,
  joinPublicLeague,
  reportLeague,
  handOverLeague,
  joinLeague,
  leaveLeague,
  listMyLeagues,
} from "@/application/leagues";
import { normalizeInviteCode } from "@/domain/league";
import { validateLeagueFamilies, type LeagueFamily } from "@/domain/league-families";
import { safeRedirectPath } from "@/domain/redirect";
import { createSupabaseLeagueRepository } from "@/infra";

import { formText } from "../form-data";
import { getCurrentUser, getSessionClient } from "../session";

export type LeagueFormState = {
  value: string;
  error?: ErrorCode;
  isPublic?: boolean;
  reported?: boolean;
  /** The families ticked, given back with an error (#613). */
  families?: LeagueFamily[];
};

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
  // « Certaines familles » sends its ticked chips; « Toutes les épreuves » sends none (#613).
  const families =
    formText(data, "families-mode") === "some"
      ? data.getAll("family").filter((v): v is string => typeof v === "string")
      : [];
  const known = validateLeagueFamilies(families);
  const keptFamilies = known.ok ? known.families : [];
  const back = `/ligues/creer?${new URLSearchParams(competitionSlugs.map((c) => ["competition", c]))}`;
  const repository = await leagues(back);
  let id: string;
  try {
    id = (
      await createLeague({ leagues: repository }).execute({
        name: value,
        competitionSlugs,
        isPublic,
        families,
      })
    ).id;
  } catch (error) {
    // Only known error codes are expected here; anything else is a bug and stays visible.
    if (error instanceof UseCaseError) {
      return { value, error: error.code, isPublic, families: keptFamilies };
    }
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
  // From an event, the player goes back to predict; from the league, the league shows it.
  const back = formText(data, "back");
  redirect(back ? safeRedirectPath(back) : `/ligues/${leagueId}?ajoutee=1`);
}

/** The creator adds a family (#613); every member sees it on the league page. */
export async function addLeagueFamilyAction(
  _: LeagueFormState,
  data: FormData,
): Promise<LeagueFormState> {
  const leagueId = formText(data, "leagueId");
  const family = formText(data, "family");
  const repository = await leagues(`/ligues/${leagueId}/familles`);
  try {
    await addLeagueFamily({ leagues: repository }).execute({ leagueId, family });
  } catch (error) {
    if (error instanceof UseCaseError) return { value: family, error: error.code };
    throw error;
  }
  revalidatePath(`/ligues/${leagueId}`);
  redirect(`/ligues/${leagueId}`);
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

/** Reports a public league to the admin (#321). */
export async function reportLeagueAction(
  _: LeagueFormState,
  data: FormData,
): Promise<LeagueFormState> {
  const leagueId = formText(data, "leagueId");
  const repository = await leagues("/ligues");
  try {
    await reportLeague({ leagues: repository }).execute({ leagueId });
  } catch (error) {
    if (error instanceof UseCaseError) return { value: leagueId, error: error.code };
    throw error;
  }
  return { value: leagueId, reported: true };
}
