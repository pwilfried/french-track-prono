import Link from "next/link";
import { notFound } from "next/navigation";

import { UseCaseError } from "@/application/errors";
import { getMyManagerScore, type MyManagerScore } from "@/application/manager-scores";
import { ErrorNotice } from "@/components/error-notice";
import { LeagueHero } from "@/components/leagues/league-hero";
import { JokerEffects } from "@/components/manager/manager-jokers";
import { PointsBreakdown } from "@/components/manager/points-breakdown";
import {
  createSupabaseManagerCatalogue,
  createSupabaseManagerLineups,
  createSupabaseManagerScoreRepository,
} from "@/infra";

import { messages } from "../../../../messages.fr";
import { getSessionClient } from "../../../../session";
import { managerPorts } from "../../../data";

const text = messages.managerPoints;

/**
 * « Mes points » (#431, #1036): the Manager score of the player for one competition of the league,
 * its three figures, every athlete who counted from the strongest to the weakest, then the bench.
 */
export default async function ManagerPointsPage({
  params,
}: {
  params: Promise<{ id: string; slug: string }>;
}) {
  const { id, slug } = await params;
  const path = `/manager/${id}/points/${slug}`;
  const ports = await managerPorts(path);
  const client = await getSessionClient();
  let mine: MyManagerScore | "error";
  try {
    mine = await getMyManagerScore({
      managerLeagues: ports.managerLeagues,
      catalogue: createSupabaseManagerCatalogue(client),
      lineups: createSupabaseManagerLineups(client),
      scores: createSupabaseManagerScoreRepository(client),
    }).execute({ leagueId: id, slug });
  } catch (error) {
    if (!(error instanceof UseCaseError)) throw error;
    if (error.code === "LEAGUE_NOT_FOUND" || error.code === "COMPETITION_NOT_FOUND") notFound();
    mine = "error";
  }

  return (
    <main id="main" className="flex flex-1 flex-col">
      <LeagueHero
        title={mine === "error" ? text.title : mine.name}
        subtitle={text.title}
        back={{ href: `/manager/${id}/alignement`, label: messages.lineup.title }}
      />
      <div className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 py-6">
        {mine === "error" ? (
          <ErrorNotice retryHref={path} message={messages.errors.MANAGER_SCORES_UNAVAILABLE} />
        ) : mine.score === null ? (
          <p role="status" className="rounded-card bg-muted p-4 text-sm font-semibold">
            {text.notYet}
          </p>
        ) : (
          <>
            <PointsBreakdown mine={{ ...mine, score: mine.score }} />
            <JokerEffects effects={mine.score.jokerEffects ?? []} />
            <Link
              href={`/manager/${id}/alignement/${slug}`}
              className="inline-flex min-h-11 items-center font-semibold text-brand dark:text-secondary"
            >
              {text.lineupLink} ›
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
