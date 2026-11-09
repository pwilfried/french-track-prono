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
import { paramText } from "../search-params";
import { getCurrentUser, getSessionClient } from "../session";

/**
 * The rankings (#376): « Général », every player and every competition added up (#319), or the
 * ranking of one competition (?competition=).
 */
export default async function GeneralRankingPage({
  searchParams,
}: {
  searchParams: Promise<{ competition?: string | string[] }>;
}) {
  const asked = paramText((await searchParams).competition);
  const { coming, past } = await loadCompetitions();
  const all = [...coming, ...past].sort((a, b) => b.startsOn.localeCompare(a.startsOn));
  const chosen = all.find((c) => c.slug === asked) ?? null;
  const here = chosen
    ? `/classement?competition=${encodeURIComponent(chosen.slug)}`
    : "/classement";
  const user = await getCurrentUser();
  if (!user) redirect(`/connexion?next=${encodeURIComponent(here)}`);

  let ranking: RankedPlayer[] | "error";
  try {
    ranking = await getGeneralRanking({
      ranking: createSupabaseRankingRepository(await getSessionClient()),
    }).execute({ competitionSlugs: chosen ? [chosen.slug] : all.map((c) => c.slug) });
  } catch (error) {
    if (!(error instanceof UseCaseError)) throw error;
    ranking = "error";
  }
  const me = ranking === "error" ? undefined : ranking.find((p) => p.userId === user.userId);

  return (
    <main id="main" className="flex flex-1 flex-col">
      <LeagueHero
        title={messages.ranking.title}
        subtitle={
          chosen ? messages.ranking.competitionSubtitle(chosen.name) : messages.ranking.subtitle
        }
      />
      <div className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 py-5">
        <nav aria-label={messages.ranking.scopeLabel} className="-mx-4 overflow-x-auto px-4">
          <ul className="flex gap-2">
            {[{ slug: null, name: messages.ranking.general }, ...all].map((c) => {
              const active = (c.slug ?? null) === (chosen?.slug ?? null);
              return (
                <li key={c.slug ?? "general"} className="shrink-0">
                  <Link
                    href={
                      c.slug
                        ? `/classement?competition=${encodeURIComponent(c.slug)}`
                        : "/classement"
                    }
                    aria-current={active ? "page" : undefined}
                    className={`inline-flex min-h-11 items-center whitespace-nowrap rounded-full border-2 px-4 text-sm font-semibold ${
                      active
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card"
                    }`}
                  >
                    {c.name}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
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
