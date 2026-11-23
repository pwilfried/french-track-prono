import Link from "next/link";

import { UseCaseError } from "@/application/errors";
import type { League } from "@/application/leagues";
import {
  getGeneralRanking,
  getLeagueRanking,
  getTonightRanking,
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
import { RankingTabs } from "@/components/leaderboard/ranking-tabs";
import { ScopeChips, type ScopeChip } from "@/components/leaderboard/scope-chips";
import { InviteBanner } from "@/components/leagues/invite-banner";
import { LeagueHero } from "@/components/leagues/league-hero";
import { buttonVariants } from "@/components/ui/button";
import { tabPanelProps } from "@/components/ui/view-tabs";
import { rankingStart } from "@/domain/competition";
import { seasonYears } from "@/domain/competition-search";
import { placeOf, previousCompetitionSlugs } from "@/domain/ranking";
import { createSupabaseLeagueJokerRepository, createSupabaseLeagueRepository } from "@/infra";

import { currentCompetitionDay, currentDay, loadCompetitions, loadMyLeagues } from "../competition";
import { messages } from "../messages.fr";
import { paramText } from "../search-params";
import { getCurrentUser, getSessionClient } from "../session";
import { publicRanking } from "../public-data";

/**
 * The rankings tab (#551, #661): the views as tabs, « Ma ligue » first (the player's first league,
 * another one from the scope sheet), « Ce soir » (points of tonight's finals, hidden before the
 * first competition) and « Général » (the whole season, or one competition with ?competition=),
 * cut around the player. One scope button opens the sheet; « Ta place » heads the list.
 * A visitor sees « Général » alone, with a link to sign in (#573). Alone in a league, the player
 * is asked to invite friends instead of seeing a ranking of one (#710).
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
  // The player is read while the competitions are.
  const [{ coming, past }, user] = await Promise.all([loadCompetitions(), getCurrentUser()]);
  const all = [...coming, ...past].sort((a, b) => b.startsOn.localeCompare(a.startsOn));
  const start = rankingStart(all, currentDay());
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
  const ranking = publicRanking();
  const leagueRanking = getLeagueRanking({
    ranking,
    leagues: createSupabaseLeagueRepository(client),
    jokers: createSupabaseLeagueJokerRepository(client),
  });
  // The moves compare with the ranking before the last finished competition of the scope (#661).
  const previousOf = (slugs: string[]) =>
    previousCompetitionSlugs(
      all.filter((c) => slugs.includes(c.slug)),
      day,
    );
  // Only the league shown is ranked: the chips of the others need no rank.
  const readLeagueRanking = async (): Promise<RankingRow[] | "error" | null> => {
    if (!league) return null;
    try {
      return await leagueRanking.execute({
        leagueId: league.id,
        competitionSlugs: league.competitionSlugs,
        families: league.families,
        competitionAddedAt: league.competitionAddedAt,
        previousSlugs: previousOf(league.competitionSlugs),
      });
    } catch (error) {
      if (!(error instanceof UseCaseError)) throw error;
      return "error";
    }
  };
  const readRows = async (): Promise<RankingRow[] | "error" | null> => {
    try {
      if (view === "soir") {
        return await getTonightRanking({ ranking }).execute({
          competitionSlugs: all.map((c) => c.slug),
          today,
        });
      }
      if (view === "general") {
        const slugs = chosen ? [chosen.slug] : all.map((c) => c.slug);
        return await getGeneralRanking({ ranking }).execute({
          competitionSlugs: slugs,
          previousSlugs: previousOf(slugs),
        });
      }
      return null;
    } catch (error) {
      if (!(error instanceof UseCaseError)) throw error;
      return "error";
    }
  };
  // The league ranking and the general or tonight one do not depend on each other: read together.
  const [leagueRows, otherRows] = await Promise.all([readLeagueRanking(), readRows()]);
  const rows: RankingRow[] | "error" | null = view === "ligue" ? leagueRows : otherRows;
  const meId = user?.userId;
  const me = Array.isArray(rows) ? rows.find((p) => p.userId === meId) : undefined;
  const place = Array.isArray(rows) && !start ? placeOf(rows, meId) : null;
  const text = messages.ranking;
  const live = all.find((c) => c.startsOn <= today && c.endsOn >= today);
  const seasonLabel = text.scope.season(seasonYears(all, day));
  const players = Array.isArray(rows) ? rows.length : null;
  const context =
    view === "soir"
      ? text.scope.tonight(live?.name ?? null, today)
      : view === "ligue"
        ? league
          ? text.context.league(league.name, league.memberCount)
          : text.context.noLeague
        : text.context.general(chosen?.name ?? seasonLabel.toLowerCase(), players);
  const chips: ScopeChip[] =
    view === "ligue"
      ? leagues.map((l) => ({
          id: l.id,
          label: text.chips.league(l.name),
          href: rankingHref("ligue", { ligue: l.id }),
          selected: l.id === league?.id,
        }))
      : [
          {
            id: "season",
            label: text.chips.season,
            href: rankingHref("general"),
            selected: !chosen,
          },
          ...all.map((c) => ({
            id: c.slug,
            label: c.name,
            href: rankingHref("general", { competition: c.slug }),
            selected: c.slug === chosen?.slug,
          })),
        ];
  // The podium takes the first three with points; the list goes on after them.
  const podiumCount = Array.isArray(rows) ? rows.slice(0, 3).filter((r) => r.points > 0).length : 0;

  return (
    <main id="main" className="flex flex-1 flex-col">
      <LeagueHero title={text.title} />
      <div className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 py-5">
        <RankingTabs
          label={text.viewLabel}
          tabs={views.map((v) => ({ id: v, label: text.view[v], href: rankingHref(v) }))}
          selected={view}
          idPrefix="vue"
          panelId="classement-vue"
        />
        <div
          id="classement-vue"
          {...tabPanelProps(views.length, "vue", view)}
          className="flex flex-col gap-4"
        >
          {view !== "soir" && (
            <ScopeChips
              chips={chips}
              extra={
                view === "ligue" ? { label: text.chips.createOrJoin, href: "/ligues" } : undefined
              }
            />
          )}
          <p className="text-sm font-semibold text-muted-foreground [overflow-wrap:anywhere]">
            {context}
          </p>

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
          ) : league && league.memberCount <= 1 ? (
            // Alone in the league: no ranking of one, bring friends in first (#710).
            <InviteBanner
              code={league.inviteCode}
              leagueName={league.name}
              isPublic={league.isPublic}
            />
          ) : rows === "error" ? (
            <ErrorNotice retryHref={here} message={messages.errors.RANKING_UNAVAILABLE} />
          ) : rows === null ? null : start ? (
            // Before the first competition: the members of the league at 0, under the banner.
            rows.length > 0 && <Leaderboard rows={rows} meId={meId} retryHref={here} />
          ) : view === "soir" && rows.length === 0 ? (
            <p className="rounded-card bg-muted p-4 text-muted-foreground">{text.tonightEmpty}</p>
          ) : (
            <>
              {place && <MyPlaceCard place={place} />}
              <Podium rows={rows} meId={meId} />
              <Leaderboard
                rows={rows}
                meId={meId}
                retryHref={here}
                aroundMe={view !== "ligue"}
                skip={podiumCount}
                lantern={view === "ligue"}
              />
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
              ) : (
                !me &&
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
          {/* « Battez FrenchTrack » (#674): its own season ranking. */}
          {user && view === "general" && (
            <Link
              href="/classement/frenchtrack"
              className="flex min-h-14 flex-col justify-center rounded-card border border-border bg-card px-4 py-2"
            >
              <span className="font-display text-lg font-extrabold">{text.challenge}</span>
              <span className="text-sm text-muted-foreground">{text.challengeHint}</span>
            </Link>
          )}
        </div>
      </div>
    </main>
  );
}
