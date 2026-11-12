import { notFound } from "next/navigation";

import { UseCaseError } from "@/application/errors";
import {
  getManagerRoundReveal,
  markManagerRoundRevealed,
  type ManagerRoundReveal,
} from "@/application/manager-reveal";
import { ErrorNotice } from "@/components/error-notice";
import {
  createSupabaseManagerBids,
  createSupabaseManagerCatalogue,
  createSupabaseManagerReveals,
} from "@/infra";

import { messages } from "../../../../messages.fr";
import { getSessionClient } from "../../../../session";
import { managerPorts } from "../../../data";
import { RoundReveal } from "../../../round-reveal";

/**
 * The reveal of a closed round of the mercato (#604): the player's cards, then every bid of the
 * round. The mercato sends the player here once per round; `?vue=toutes` opens the summary directly.
 * Showing the page marks the reveal as seen.
 */
export default async function RoundRevealPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; round: string }>;
  searchParams: Promise<{ vue?: string }>;
}) {
  const { id, round: param } = await params;
  const { vue } = await searchParams;
  const path = `/manager/${id}/tour/${param}`;
  const ports = await managerPorts(path);
  const round = Number(param);
  if (!Number.isInteger(round) || round < 1) notFound();

  const client = await getSessionClient();
  const reveals = createSupabaseManagerReveals(client);
  let reveal: ManagerRoundReveal | "error";
  try {
    reveal = await getManagerRoundReveal({
      reveals,
      bids: createSupabaseManagerBids(client),
      catalogue: createSupabaseManagerCatalogue(client),
      managerLeagues: ports.managerLeagues,
    }).execute({ leagueId: id, round, userId: ports.userId });
    await markManagerRoundRevealed({ reveals }).execute({ leagueId: id, round });
  } catch (error) {
    if (!(error instanceof UseCaseError)) throw error;
    if (error.code === "LEAGUE_NOT_FOUND" || error.code === "ROUND_NOT_FOUND") notFound();
    reveal = "error";
  }

  return (
    <main id="main" className="flex flex-1 flex-col">
      {reveal === "error" ? (
        <div className="mx-auto w-full max-w-md px-4 py-6">
          <ErrorNotice retryHref={path} message={messages.errors.MANAGER_BIDS_UNAVAILABLE} />
        </div>
      ) : (
        <RoundReveal leagueId={id} reveal={reveal} step={vue === "toutes" ? "all" : "cards"} />
      )}
    </main>
  );
}
