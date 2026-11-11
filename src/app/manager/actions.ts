"use server";

import { redirect } from "next/navigation";

import { UseCaseError, type ErrorCode } from "@/application/errors";
import { createManagerLeague } from "@/application/manager-leagues";

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
