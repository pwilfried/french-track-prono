"use server";

import { redirect } from "next/navigation";

import { UseCaseError, type ErrorCode } from "@/application/errors";
import {
  createManagerLeague,
  joinManagerLeague,
  joinPublicManagerLeague,
} from "@/application/manager-leagues";

import { formText } from "../form-data";
import { managerPorts } from "./data";

export type ManagerLeagueFormState = { value: string; isPublic: boolean; error?: ErrorCode };

export async function createManagerLeagueAction(
  _: ManagerLeagueFormState,
  data: FormData,
): Promise<ManagerLeagueFormState> {
  const value = formText(data, "name");
  const isPublic = formText(data, "public") === "1";
  const ports = await managerPorts("/manager/creer");
  let id: string;
  try {
    id = (await createManagerLeague(ports).execute({ name: value, isPublic })).id;
  } catch (error) {
    if (error instanceof UseCaseError) return { value, isPublic, error: error.code };
    throw error;
  }
  redirect(`/manager/${id}`);
}

export type JoinManagerLeagueState = { value: string; error?: ErrorCode };

/** Joins with a code; a player already in the league is simply taken to it. */
export async function joinManagerLeagueAction(
  _: JoinManagerLeagueState,
  data: FormData,
): Promise<JoinManagerLeagueState> {
  const value = formText(data, "code");
  const ports = await managerPorts(`/manager/rejoindre?code=${encodeURIComponent(value)}`);
  let id: string;
  try {
    id = await joinManagerLeague(ports).execute({ code: value });
  } catch (error) {
    if (error instanceof UseCaseError) return { value, error: error.code };
    throw error;
  }
  redirect(`/manager/${id}`);
}

/** Joins a public league in one tap, from the list. */
export async function joinPublicManagerLeagueAction(
  _: JoinManagerLeagueState,
  data: FormData,
): Promise<JoinManagerLeagueState> {
  const leagueId = formText(data, "league");
  const ports = await managerPorts("/manager");
  let id: string;
  try {
    id = await joinPublicManagerLeague(ports).execute({ id: leagueId });
  } catch (error) {
    if (error instanceof UseCaseError) return { value: leagueId, error: error.code };
    throw error;
  }
  redirect(`/manager/${id}`);
}
