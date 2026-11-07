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

import { COMPETITION_SLUG, COMPETITION_TEXT } from "../competition";
import { messages } from "../messages.fr";
import { getCurrentUser, getSessionClient } from "../session";

export default async function GeneralRankingPage() {
  const user = await getCurrentUser();
  if (!user) redirect(`/connexion?next=${encodeURIComponent("/classement")}`);

  let ranking: RankedPlayer[] | "error";
  try {
    ranking = await getGeneralRanking({
      ranking: createSupabaseRankingRepository(await getSessionClient()),
    }).execute({ competitionSlug: COMPETITION_SLUG });
  } catch (error) {
    if (!(error instanceof UseCaseError)) throw error;
    ranking = "error";
  }
  const me = ranking === "error" ? undefined : ranking.find((p) => p.userId === user.userId);

  return (
    <main className="flex flex-1 flex-col">
      <LeagueHero
        title={messages.ranking.title}
        subtitle={messages.ranking.subtitle(COMPETITION_TEXT.name)}
      />
      <div className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 py-5">
        {ranking === "error" ? (
          <ErrorNotice retryHref="/classement" message={messages.errors.RANKING_UNAVAILABLE} />
        ) : (
          <>
            <Leaderboard rows={ranking} meId={user.userId} retryHref="/classement" />
            {ranking.length > 0 &&
              (me ? (
                <p className="sticky bottom-3 rounded-2xl bg-foreground px-3.5 py-3 font-extrabold text-background shadow-lg">
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
