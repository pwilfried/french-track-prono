import { notFound } from "next/navigation";

import { UseCaseError } from "@/application/errors";
import { getMyLineup, type MyLineup } from "@/application/manager-lineup";
import { LockLine } from "@/components/countdown/lock-line";
import { ErrorNotice } from "@/components/error-notice";
import { LeagueHero } from "@/components/leagues/league-hero";
import {
  createSupabaseManagerBids,
  createSupabaseManagerCatalogue,
  createSupabaseManagerLineups,
} from "@/infra";

import { messages } from "../../../../messages.fr";
import { getSessionClient } from "../../../../session";
import { managerPorts } from "../../../data";
import { LineupForm } from "./lineup-form";

const text = messages.lineup;

/**
 * The player's lineup for one eligible competition of the league (#427): the stadium, the bench
 * and « Valider mon alignement », until the competition's first prediction lock.
 */
export default async function LineupPage({
  params,
}: {
  params: Promise<{ id: string; slug: string }>;
}) {
  const { id, slug } = await params;
  const path = `/manager/${id}/alignement/${slug}`;
  const ports = await managerPorts(path);
  const client = await getSessionClient();
  let lineup: MyLineup | "error";
  try {
    lineup = await getMyLineup({
      managerLeagues: ports.managerLeagues,
      bids: createSupabaseManagerBids(client),
      catalogue: createSupabaseManagerCatalogue(client),
      lineups: createSupabaseManagerLineups(client),
    }).execute({ leagueId: id, slug, now: new Date().toISOString() });
  } catch (error) {
    if (!(error instanceof UseCaseError)) throw error;
    if (error.code === "LEAGUE_NOT_FOUND" || error.code === "COMPETITION_NOT_FOUND") notFound();
    lineup = "error";
  }

  return (
    <main id="main" className="flex flex-1 flex-col">
      <LeagueHero
        title={lineup === "error" ? text.title : lineup.name}
        subtitle={text.subtitle}
        back={{ href: `/manager/${id}/alignement`, label: text.title }}
      />
      <div className="mx-auto flex w-full max-w-md flex-col gap-5 px-4 py-6 md:max-w-3xl">
        {lineup === "error" ? (
          <ErrorNotice retryHref={path} message={messages.errors.LINEUPS_UNAVAILABLE} />
        ) : !lineup.mercatoClosed ? (
          <p role="status" className="rounded-card bg-muted p-4 text-sm font-semibold">
            {text.notOver}
          </p>
        ) : (
          <>
            <p className="text-sm font-semibold text-muted-foreground">
              <LockLine lockAt={lineup.lockAt} />
            </p>
            <LineupForm
              leagueId={id}
              competitionId={lineup.competitionId}
              slug={lineup.slug}
              places={lineup.places}
              fillable={lineup.fillable}
              athletes={lineup.athletes}
              initial={lineup.placed}
              status={lineup.status}
            />
          </>
        )}
      </div>
    </main>
  );
}
