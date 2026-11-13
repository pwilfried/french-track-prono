"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { UseCaseError, type ErrorCode } from "@/application/errors";
import {
  closeManagerMercato,
  placeManagerBid,
  withdrawManagerBid,
} from "@/application/manager-bids";
import { createSupabaseManagerBids } from "@/infra";

import { formText } from "../form-data";
import { getSessionClient } from "../session";
import { managerPorts } from "./data";

export type BidFormState = { error?: ErrorCode };

/** Places, changes (intent "bid") or withdraws (intent "withdraw") a secret bid (#422). */
export async function managerBidAction(_: BidFormState, data: FormData): Promise<BidFormState> {
  const leagueId = formText(data, "league");
  const athleteId = formText(data, "athlete");
  await managerPorts(`/manager/${leagueId}/catalogue`);
  const ports = { bids: createSupabaseManagerBids(await getSessionClient()) };
  try {
    if (formText(data, "intent") === "withdraw") {
      await withdrawManagerBid(ports).execute({ leagueId, athleteId });
    } else {
      await placeManagerBid(ports).execute({
        leagueId,
        athleteId,
        amount: formText(data, "amount"),
      });
    }
  } catch (error) {
    if (error instanceof UseCaseError) return { error: error.code };
    throw error;
  }
  revalidatePath(`/manager/${leagueId}/catalogue`);
  return {};
}

/** The last participant who can still recruit closes the mercato of the league (#424). */
export async function closeMercatoAction(_: BidFormState, data: FormData): Promise<BidFormState> {
  const leagueId = formText(data, "league");
  await managerPorts(`/manager/${leagueId}/catalogue`);
  const ports = { bids: createSupabaseManagerBids(await getSessionClient()) };
  try {
    await closeManagerMercato(ports).execute({ leagueId });
  } catch (error) {
    if (error instanceof UseCaseError) return { error: error.code };
    throw error;
  }
  revalidatePath(`/manager/${leagueId}/catalogue`);
  // The bids under way became a last round: the mercato opens its reveal (#604).
  redirect(`/manager/${leagueId}/catalogue`);
}
