import Link from "next/link";
import { notFound } from "next/navigation";

import { UseCaseError } from "@/application/errors";
import { getManagerLeague } from "@/application/manager-leagues";
import { getManagerMercatoReview, type ManagerMercatoReview } from "@/application/manager-reveal";
import { CompetitionChips } from "@/components/events/competition-chips";
import { ErrorNotice } from "@/components/error-notice";
import { LeagueHero } from "@/components/leagues/league-hero";
import { RoundSummary } from "@/components/manager/round-summary";
import { buttonVariants } from "@/components/ui/button";
import { createSupabaseManagerCatalogue, createSupabaseManagerReveals } from "@/infra";

import { messages } from "../../../messages.fr";
import { getSessionClient } from "../../../session";
import { managerPorts } from "../../data";

const text = messages.mercatoReview;

/**
 * The mercato read again round by round (#1089): one round at a time (`?tour=N`, the first one by
 * default), every athlete bid on with every bid and who won. Only closed rounds are listed, row level
 * security keeps the bids of a round still open secret; the league links here once the mercato is over.
 */
export default async function MercatoReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tour?: string }>;
}) {
  const { id } = await params;
  const { tour } = await searchParams;
  const path = `/manager/${id}/mercato`;
  const ports = await managerPorts(tour ? `${path}?tour=${tour}` : path);
  const client = await getSessionClient();

  let review: ManagerMercatoReview | "error";
  let leagueName: string | null = null;
  try {
    const [found, league] = await Promise.all([
      getManagerMercatoReview({
        reveals: createSupabaseManagerReveals(client),
        catalogue: createSupabaseManagerCatalogue(client),
        managerLeagues: ports.managerLeagues,
      }).execute({ leagueId: id, round: Number(tour) || undefined, userId: ports.userId }),
      getManagerLeague(ports).execute({ id }),
    ]);
    review = found;
    leagueName = league.name;
  } catch (error) {
    if (!(error instanceof UseCaseError)) throw error;
    if (error.code === "LEAGUE_NOT_FOUND") notFound();
    review = "error";
  }

  return (
    <main id="main" className="flex flex-1 flex-col">
      <LeagueHero
        title={text.title}
        subtitle={text.subtitle}
        // Back to the league the player comes from, by its name (#987).
        back={{ href: `/manager/${id}`, label: leagueName ?? messages.manager.back }}
      />
      <div className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 py-6">
        {review === "error" ? (
          <ErrorNotice retryHref={path} message={messages.errors.MANAGER_BIDS_UNAVAILABLE} />
        ) : review.round === null ? (
          <>
            <p className="rounded-card bg-muted p-4 text-sm text-muted-foreground">{text.empty}</p>
            <Link href={`/manager/${id}/equipe`} className={`${buttonVariants()} w-full`}>
              {text.toTeam}
            </Link>
          </>
        ) : (
          <>
            <CompetitionChips
              label={text.rounds}
              chips={review.rounds.map((round) => ({
                key: String(round),
                name: messages.roundReveal.roundLink(round),
                active: round === review.round,
                href: `${path}?tour=${round}`,
              }))}
            />
            <RoundSummary round={review.round} athletes={review.athletes} />
          </>
        )}
      </div>
    </main>
  );
}
