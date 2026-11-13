import Link from "next/link";

import { UseCaseError } from "@/application/errors";
import type { League } from "@/application/leagues";
import {
  getGeneralRanking,
  getLeagueRanking,
  getTonightRanking,
  standingIn,
  type RankingRow,
} from "@/application/rankings";
import { ErrorNotice } from "@/components/error-notice";
import { Leaderboard } from "@/components/leaderboard/leaderboard";
import { MyPlaceCard } from "@/components/leaderboard/my-place-card";
import { Podium } from "@/components/leaderboard/podium";
import {
  RANKING_VIEWS,
  rankingHref,
  type RankingView,
} from "@/components/leaderboard/ranking-href";
import type { ScopeLeague } from "@/components/leaderboard/scope-sheet";
import { ScopeSwitcher } from "@/components/leaderboard/scope-switcher";
import { LeagueHero } from "@/components/leagues/league-hero";
import { buttonVariants } from "@/components/ui/button";
import { rankingStart } from "@/domain/competition";
import { seasonYears } from "@/domain/competition-search";
import { placeOf, previousCompetitionSlugs } from "@/domain/ranking";
import { createSupabaseLeagueRepository, createSupabaseRankingRepository } from "@/infra";
import { cn } from "@/lib/utils";

import { currentCompetitionDay, currentDay, loadCompetitions, loadMyLeagues } from "../competition";
import { messages } from "../messages.fr";
import { paramText } from "../search-params";
import { getCurrentUser, getSessionClient } from "../session";

/**
 * The rankings tab (#551, #661): the views as tabs, « Ma ligue » first (the player's first league,
 * another one from the scope sheet), « Ce soir » (points of tonight's finals, hidden before the
 * first competition) and « Général » (the whole season, or one competition with ?competition=),
 * cut around the player. One scope button opens the sheet; « Ta place » heads the list.
 * A visitor sees « Général » alone, with a link to sign in (#573).
 */
export default async function RankingPage({
  searchParams,
}: {
  searchParams: Promise<{
    vue?: string | string[];
    ligue?: string | string[];
    competition?: string | string[];
  }>;
}) {
  const query = await searchParams;
  const { coming, past } = await loadCompetitions();
  const all = [...coming, ...past].sort((a, b) => b.startsOn.localeCompare(a.startsOn));
  const start = rankingStart(all, currentDay());
  const user = await getCurrentUser();
  const views: readonly RankingView[] = user
    ? RANKING_VIEWS.filter((v) => v !== "soir" || !start)
    : ["general"];
  const view = views.find((v) => v === paramText(query.vue)) ?? views[0]!;
  const chosen =
    view === "general" ? (all.find((c) => c.slug === paramText(query.competition)) ?? null) : null;

  const leagues = user ? await loadMyLeagues() : [];
  const league: League | null =
    view === "ligue"
      ? (leagues.find((l) => l.id === paramText(query.ligue)) ?? leagues[0] ?? null)
      : null;
  const here = rankingHref(view, { ligue: league?.id, competition: chosen?.slug });

  const today = currentCompetitionDay();
  const day = currentDay();
  const client = await getSessionClient();
  const ranking = createSupabaseRankingRepository(client);
  const leagueRanking = getLeagueRanking({
    ranking,
    leagues: createSupabaseLeagueRepository(client),
  });
  // The moves compare with the ranking before the last finished competition of the scope (#661).
  const previousOf = (slugs: string[]) =>
    previousCompetitionSlugs(
      all.filter((c) => slugs.includes(c.slug)),
      day,
    );
  // The player's leagues in the scope sheet, with their rank: one ranking per league, fine for
  // the few leagues a player is in. « error » when they cannot be read.
  let leagueRankings: RankingRow[][] | "error";
  try {
    leagueRankings = await Promise.all(
      leagues.map((l) =>
        leagueRanking.execute({
          leagueId: l.id,
          competitionSlugs: l.competitionSlugs,
          previousSlugs: previousOf(l.competitionSlugs),
        }),
      ),
    );
  } catch (error) {
    if (!(error instanceof UseCaseError)) throw error;
    leagueRankings = "error";
  }
  const scopeLeagues: ScopeLeague[] = leagues.map((l, i) => ({
    id: l.id,
    name: l.name,
    memberCount: l.memberCount,
    rank:
      user && leagueRankings !== "error"
        ? (standingIn(leagueRankings[i]!, user.userId)?.rank ?? null)
        : null,
    competitions: l.competitionSlugs.length,
  }));

  let rows: RankingRow[] | "error" | null = null;
  try {
    if (view === "ligue" && league) {
      rows = leagueRankings === "error" ? "error" : leagueRankings[leagues.indexOf(league)]!;
    } else if (view === "soir") {
      rows = await getTonightRanking({ ranking }).execute({
        competitionSlugs: all.map((c) => c.slug),
        today,
      });
    } else if (view === "general") {
      const slugs = chosen ? [chosen.slug] : all.map((c) => c.slug);
      rows = await getGeneralRanking({ ranking }).execute({
        competitionSlugs: slugs,
        previousSlugs: previousOf(slugs),
      });
    }
  } catch (error) {
    if (!(error instanceof UseCaseError)) throw error;
    rows = "error";
  }
  const meId = user?.userId;
  const me = Array.isArray(rows) ? rows.find((p) => p.userId === meId) : undefined;
  const place = Array.isArray(rows) && !start ? placeOf(rows, meId) : null;
  const text = messages.ranking;
  const live = all.find((c) => c.startsOn <= today && c.endsOn >= today);
  const seasonLabel = text.scope.season(seasonYears(all));
  const sheet = {
    competitions: all,
    competition: view === "general" ? (chosen?.slug ?? null) : undefined,
    seasonLabel,
    today: day,
    leagues: user ? scopeLeagues : undefined,
    league: league?.id,
  };
  const subtitle =
    view === "ligue"
      ? league
        ? text.leagueSubtitle(league.name)
        : text.noLeagueSubtitle
      : view === "soir"
        ? text.tonightSubtitle
        : chosen
          ? text.competitionSubtitle(chosen.name)
          : text.subtitle;

  return (
    <main id="main" className="flex flex-1 flex-col">
      <LeagueHero title={text.title} subtitle={subtitle} />
      <div className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 py-5">
        <div
          role="tablist"
          aria-label={text.viewLabel}
          className="grid gap-1 rounded-full bg-muted p-1"
          style={{ gridTemplateColumns: `repeat(${views.length}, minmax(0, 1fr))` }}
        >
          {views.map((v) => (
            <Link
              key={v}
              href={rankingHref(v)}
              role="tab"
              aria-selected={v === view}
              aria-controls="classement-vue"
              id={`vue-${v}`}
              className={cn(
                "inline-flex min-h-11 items-center justify-center rounded-full px-2 text-sm font-semibold",
                v === view ? "bg-card text-foreground shadow-sm" : "text-muted-foreground",
              )}
            >
              {text.view[v]}
            </Link>
          ))}
        </div>
        <div
          id="classement-vue"
          role="tabpanel"
          aria-labelledby={`vue-${view}`}
          className="flex flex-col gap-4"
        >
          {view === "soir" ? (
            <p className="text-sm font-semibold text-muted-foreground">
              {text.scope.tonight(live?.name ?? null, today)}
            </p>
          ) : view === "ligue" ? (
            league && (
              <ScopeSwitcher
                key={view}
                label={text.scope.league}
                value={league.name}
                detail={text.scope.players(league.memberCount)}
                tab="leagues"
                {...sheet}
              />
            )
          ) : (
            <ScopeSwitcher
              key={view}
              label={text.scope.general}
              value={chosen?.name ?? seasonLabel}
              tab="competitions"
              {...sheet}
            />
          )}

          {start && (
            <section className="flex flex-col gap-3 rounded-card bg-brand p-4 text-brand-foreground">
              <p className="font-display text-lg font-extrabold">
                {text.starts(start.startsOn, start.days)}
              </p>
              <Link href="/competitions" className={`${buttonVariants()} w-full`}>
                {text.firstPodiums}
              </Link>
            </section>
          )}

          {view === "ligue" && !league ? (
            <div className="flex flex-col gap-3 rounded-card bg-muted p-4 text-sm text-muted-foreground">
              <p>
                <strong className="block text-foreground">{messages.leagues.emptyTitle}</strong>
                {messages.leagues.emptyText}
              </p>
              <Link href="/ligues/creer" className={`${buttonVariants()} w-full`}>
                {messages.leagues.create}
              </Link>
              <Link
                href="/ligues/rejoindre"
                className={`${buttonVariants({ variant: "outline" })} w-full`}
              >
                {messages.leagues.join}
              </Link>
            </div>
          ) : rows === "error" ? (
            <ErrorNotice retryHref={here} message={messages.errors.RANKING_UNAVAILABLE} />
          ) : rows === null ? null : start ? (
            // Before the first competition: the members of the league at 0, under the banner.
            rows.length > 0 && <Leaderboard rows={rows} meId={meId} retryHref={here} />
          ) : view === "soir" && rows.length === 0 ? (
            <p className="rounded-card bg-muted p-4 text-muted-foreground">{text.tonightEmpty}</p>
          ) : (
            <>
              {place && <MyPlaceCard place={place} showTop={view === "general"} />}
              <Podium rows={rows} meId={meId} />
              <Leaderboard rows={rows} meId={meId} retryHref={here} aroundMe={view !== "ligue"} />
              {!user ? (
                <section className="flex flex-col gap-3 rounded-card bg-muted p-4">
                  <p>{text.visitor}</p>
                  <Link
                    href={`/connexion?next=${encodeURIComponent(here)}`}
                    className={`${buttonVariants()} w-full`}
                  >
                    {messages.account.signIn}
                  </Link>
                </section>
              ) : me ? (
                <p className="sticky bottom-20 flex items-center justify-between gap-3 rounded-2xl bg-foreground py-1.5 pl-3.5 pr-1.5 font-extrabold text-background shadow-lg md:bottom-3">
                  <span>{text.you(me.rank, me.points)}</span>
                  <a
                    href="#moi"
                    className="inline-flex min-h-11 items-center rounded-xl px-3 underline underline-offset-4"
                  >
                    {text.aroundMe}
                  </a>
                </p>
              ) : (
                rows.length > 0 && (
                  <p className="rounded-card bg-muted p-4 text-sm text-muted-foreground">
                    {view === "soir" ? text.notRankedTonight : text.notRanked}
                  </p>
                )
              )}
              {user && !me && view === "general" && (
                <Link href="/competitions" className={`${buttonVariants()} w-full`}>
                  {text.predict}
                </Link>
              )}
            </>
          )}
        </div>
      </div>
    </main>
  );
}
