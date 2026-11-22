"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { UseCaseError } from "@/application/errors";
import { leaveManagerRoundReveal } from "@/application/manager-reveal";
import { createSupabaseManagerBids, createSupabaseManagerReveals } from "@/infra";

import { formText } from "../form-data";
import { getSessionClient } from "../session";
import { managerPorts } from "./data";

/**
 * « Retour au mercato » from the reveal of a round (#1120): the round is marked seen, the browser's
 * cached pages of the league are dropped (the mercato kept 30 s its answer « open the reveal »,
 * #824), then the mercato opens, or the team once the mercato is closed.
 */
export async function leaveRoundRevealAction(data: FormData): Promise<void> {
  const leagueId = formText(data, "league");
  const round = Number(formText(data, "round"));
  const base = `/manager/${leagueId}`;
  await managerPorts(`${base}/tour/${round}`);
  const client = await getSessionClient();
  let next: "mercato" | "team" = "mercato";
  try {
    next = await leaveManagerRoundReveal({
      reveals: createSupabaseManagerReveals(client),
      bids: createSupabaseManagerBids(client),
    }).execute({ leagueId, round });
  } catch (error) {
    // The mercato shows the refusal (a league the player is not in, a round still open).
    if (!(error instanceof UseCaseError)) throw error;
  }
  revalidatePath(base, "layout");
  redirect(next === "team" ? `${base}/equipe` : `${base}/catalogue`);
}
