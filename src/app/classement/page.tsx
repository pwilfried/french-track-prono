import Link from "next/link";

import { UseCaseError } from "@/application/errors";
import type { League } from "@/application/leagues";
import { listEvents } from "@/application/list-events";
import { getPlayerDetails } from "@/application/player-details";
import {
  getClubRanking,
  getGeneralRanking,
  getLeagueRanking,
  getTonightRanking,
  type RankingRow,
} from "@/application/rankings";
import { ErrorNotice } from "@/components/error-notice";
import { ClubRanking } from "@/components/leaderboard/club-ranking";
import { Leaderboard } from "@/components/leaderboard/leaderboard";
import { MyPlaceCard } from "@/components/leaderboard/my-place-card";
import { Podium } from "@/components/leaderboard/podium";
import {
  ALL_PLAYERS,
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
import { competitionDay, rankingStart } from "@/domain/competition";
import { seasonYears } from "@/domain/competition-search";
import { placeOf, previousCompetitionSlugs } from "@/domain/ranking";
import {
  createSupabaseLeagueJokerRepository,
  createSupabaseLeagueRepository,
  createSupabasePlayerDetailsRepository,
} from "@/infra";

import { currentCompetitionDay, currentDay, loadCompetitions, loadMyLeagues } from "../competition";
import { messages } from "../messages.fr";
import { paramText } from "../search-params";
import { readOr } from "../read-or";
import { getCurrentUser, getSessionClient } from "../session";
import { publicEventReader, publicRanking } from "../public-data";

/**
 * The rankings tab (#551, #661): the views as tabs, « Ma ligue » first (the player's first league,
 * another one from the scope sheet), « Ce soir » (points of tonight's finals in one of the player's
 * leagues or for all, or of the last evening on a day without finals, #1132; hidden before the
 * first competition) and « Général » (the whole season, one competition with ?competition=, or the
 * clubs with ?clubs=1, #1132), cut around the player. One scope button opens the sheet; « Ta place » heads the list.
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
    clubs?: string | string[];
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
  const clubs = view === "general" && paramText(query.clubs) === "1";
  const chosen =
    view === "general" && !clubs
      ? (all.find((c) => c.slug === paramText(query.competition)) ?? null)
      : null;

  const leagues = user ? await loadMyLeagues() : [];
  const asked = paramText(query.ligue);
  const league: League | null =
    view === "ligue" ? (leagues.find((l) => l.id === asked) ?? leagues[0] ?? null) : null;
  // « Ce soir » of one league, the first by default, or of all players (#1132).
  const tonightLeague: League | null =
    view === "soir" && asked !== ALL_PLAYERS
      ? (leagues.find((l) => l.id === asked) ?? leagues[0] ?? null)
      : null;
  const here = rankingHref(view, {
    ligue: view === "soir" ? (tonightLeague?.id ?? ALL_PLAYERS) : league?.id,
    competition: chosen?.slug,
    clubs,
  });

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
  const live = all.find((c) => c.startsOn <= today && c.endsOn >= today);
  // Finals scheduled tonight: « Ce soir » waits for their results rather than showing another day.
  const readFinalsToday = async () => {
    if (!live) return false;
    const events = await readOr(
      "ranking finals today",
      listEvents({ events: publicEventReader() }).execute({ competitionSlug: live.slug }),
      [],
    );
    return events.some((e) => competitionDay(e.startsAt) === today);
  };
  // « Ce soir »: the evening shown and whether finals are scheduled tonight (#1132).
  const readTonight = async () => {
    if (view !== "soir") return null;
    const finalsToday = await readFinalsToday();
    try {
      const tonight = await getTonightRanking({
        ranking,
        leagues: createSupabaseLeagueRepository(client),
        jokers: createSupabaseLeagueJokerRepository(client),
      }).execute({
        competitionSlugs: tonightLeague?.competitionSlugs ?? all.map((c) => c.slug),
        today,
        finalsToday,
        league: tonightLeague
          ? {
              leagueId: tonightLeague.id,
              families: tonightLeague.families,
              competitionAddedAt: tonightLeague.competitionAddedAt,
            }
          : undefined,
      });
      return { ...tonight, finalsToday };
    } catch (error) {
      if (!(error instanceof UseCaseError)) throw error;
      return { day: today, rows: "error" as const, finalsToday };
    }
  };
  const readRows = async (): Promise<RankingRow[] | "error" | null> => {
    try {
      if (view === "general" && !clubs) {
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
  // The clubs of the season (#386, #1132) and the player's validated club.
  const readClubs = async () => {
    if (!clubs) return null;
    try {
      return await getClubRanking({ ranking }).execute({
        competitionSlugs: all.map((c) => c.slug),
      });
    } catch (error) {
      if (!(error instanceof UseCaseError)) throw error;
      return "error" as const;
    }
  };
  const readMyClub = async () => {
    if (!clubs || !user) return undefined;
    const details = await readOr(
      "ranking my club",
      getPlayerDetails({ details: createSupabasePlayerDetailsRepository(client) }).execute({
        userId: user.userId,
      }),
      null,
    );
    return details?.club?.validated ? details.club : null;
  };
  // The rankings do not depend on each other: read together.
  const [leagueRows, otherRows, tonight, clubRows, myClub] = await Promise.all([
    readLeagueRanking(),
    readRows(),
    readTonight(),
    readClubs(),
    readMyClub(),
  ]);
  const rows: RankingRow[] | "error" | null =
    view === "ligue" ? leagueRows : tonight ? tonight.rows : otherRows;
  const meId = user?.userId;
  const me = Array.isArray(rows) ? rows.find((p) => p.userId === meId) : undefined;
  const place = Array.isArray(rows) && !start ? placeOf(rows, meId) : null;
  const text = messages.ranking;
  // A day without finals: the evening shown is an earlier one, or none yet (#1132).
  const evening = tonight?.day ?? null;
  const finalsTonight = tonight?.finalsToday ?? false;
  const noFinal = evening !== null && evening !== today;
  const noEvening = evening === today && Array.isArray(rows) && rows.length === 0;
  const seasonLabel = text.scope.season(seasonYears(all, day));
  const players = Array.isArray(rows) ? rows.length : null;
  const context =
    view === "soir"
      ? noFinal
        ? text.noFinal(evening)
        : text.scope.tonight(tonightLeague?.name ?? live?.name ?? null, today)
      : clubs
        ? text.context.clubs(seasonLabel.toLowerCase())
        : view === "ligue"
          ? league
            ? text.context.league(league.name, league.memberCount)
            : text.context.noLeague
          : text.context.general(chosen?.name ?? seasonLabel.toLowerCase(), players);
  const leagueChips = (shown: League | null): ScopeChip[] =>
    leagues.map((l) => ({
      id: l.id,
      label: text.chips.league(l.name),
      href: rankingHref(view, { ligue: l.id }),
      selected: l.id === shown?.id,
    }));
  const chips: ScopeChip[] =
    view === "ligue"
      ? leagueChips(league)
      : view === "soir"
        ? [
            ...leagueChips(tonightLeague),
            {
              id: ALL_PLAYERS,
              label: text.chips.all,
              href: rankingHref("soir", { ligue: ALL_PLAYERS }),
              selected: !tonightLeague,
            },
          ]
        : [
            {
              id: "season",
              label: text.chips.season,
              href: rankingHref("general"),
              selected: !chosen && !clubs,
            },
            {
              id: "clubs",
              label: text.chips.clubs,
              href: rankingHref("general", { clubs: true }),
              selected: clubs,
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
          {(view !== "soir" || leagues.length > 0) && (
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

          {clubs ? (
            clubRows === "error" ? (
              <ErrorNotice retryHref={here} message={messages.errors.RANKING_UNAVAILABLE} />
            ) : (
              clubRows && <ClubRanking clubs={clubRows} myClub={myClub} meId={meId} />
            )
          ) : view === "ligue" && !league ? (
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
          ) : noEvening ? (
            // Finals tonight, results to come; or no evening with points yet.
            <p className="rounded-card bg-muted p-4 text-muted-foreground">
              {finalsTonight ? text.tonightEmpty : text.noFinal(null)}
            </p>
          ) : (
            <>
              {place && <MyPlaceCard place={place} />}
              <Podium rows={rows} meId={meId} />
              <Leaderboard
                rows={rows}
                meId={meId}
                retryHref={here}
                aroundMe={view === "general" || (view === "soir" && !tonightLeague)}
                skip={podiumCount}
                lantern={view === "ligue" || tonightLeague !== null}
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
