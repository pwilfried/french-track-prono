import Link from "next/link";
import { redirect } from "next/navigation";

import { UseCaseError } from "@/application/errors";
import { getGeneralRanking } from "@/application/rankings";
import { ErrorNotice } from "@/components/error-notice";
import { Leaderboard } from "@/components/leaderboard/leaderboard";
import { LeagueHero } from "@/components/leagues/league-hero";
import { buttonVariants } from "@/components/ui/button";
import type { RankedPlayer } from "@/domain/ranking";
import { createSupabaseRankingRepository } from "@/infra";

import { loadCompetitions } from "../competition";
import { messages } from "../messages.fr";
import { getCurrentUser, getSessionClient } from "../session";

/** The general ranking: every player, the points of every competition added up (#319). */
export default async function GeneralRankingPage() {
  const here = "/classement";
  const user = await getCurrentUser();
  if (!user) redirect(`/connexion?next=${encodeURIComponent(here)}`);

  let ranking: RankedPlayer[] | "error";
  try {
    const { coming, past } = await loadCompetitions();
    ranking = await getGeneralRanking({
      ranking: createSupabaseRankingRepository(await getSessionClient()),
    }).execute({ competitionSlugs: [...coming, ...past].map((c) => c.slug) });
  } catch (error) {
    if (!(error instanceof UseCaseError)) throw error;
    ranking = "error";
  }
  const me = ranking === "error" ? undefined : ranking.find((p) => p.userId === user.userId);

  return (
    <main id="main" className="flex flex-1 flex-col">
      <LeagueHero title={messages.ranking.title} subtitle={messages.ranking.subtitle} />
      <div className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 py-5">
        {ranking === "error" ? (
          <ErrorNotice retryHref={here} message={messages.errors.RANKING_UNAVAILABLE} />
        ) : (
          <>
            <Leaderboard rows={ranking} meId={user.userId} retryHref={here} />
            {ranking.length > 0 &&
              (me ? (
                <p className="sticky bottom-20 rounded-2xl bg-foreground md:bottom-3 px-3.5 py-3 font-extrabold text-background shadow-lg">
                  {messages.ranking.mine(me.rank, ranking.length, me.points)}
                </p>
              ) : (
                <p className="rounded-card bg-muted p-4 text-sm text-muted-foreground">
                  {messages.ranking.notRanked}
                </p>
              ))}
            {!me && (
              <Link href="/epreuves" className={`${buttonVariants()} w-full`}>
                {messages.ranking.predict}
              </Link>
            )}
          </>
        )}
      </div>
    </main>
  );
}
