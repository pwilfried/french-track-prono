import Link from "next/link";

import { UseCaseError } from "@/application/errors";
import { getGeneralRanking, getLeagueRanking, type RankingRow } from "@/application/rankings";
import { ErrorNotice } from "@/components/error-notice";
import { CompetitionChips } from "@/components/events/competition-chips";
import { Leaderboard } from "@/components/leaderboard/leaderboard";
import { RankingPodium } from "@/components/leaderboard/ranking-podium";
import { LeagueHero } from "@/components/leagues/league-hero";
import { buttonVariants } from "@/components/ui/button";
import { competitionDay, parisDay, rankingStart } from "@/domain/competition";
import { rankingWindow } from "@/domain/ranking";
import { createSupabaseLeagueRepository, createSupabaseRankingRepository } from "@/infra";

import { loadCompetitions, loadMyLeagues } from "../competition";
import { messages } from "../messages.fr";
import { paramText } from "../search-params";
import { getCurrentUser, getSessionClient } from "../session";

type Tab = "ligue" | "soir" | "general";
const text = messages.ranking;

/**
 * The rankings (#551): « Ma ligue » first (the player's first league, a picker when there are
 * several), « Ce soir » while a competition is under way, then « Général » (top 10 and the player
 * among their neighbours), which `?competition=` narrows to one competition (#376).
 * A visitor sees « Général » alone, with a link to sign in (#573).
 */
export default async function RankingPage({
  searchParams,
}: {
  searchParams: Promise<{
    onglet?: string | string[];
    ligue?: string | string[];
    competition?: string | string[];
  }>;
}) {
  const query = await searchParams;
  const asked = new URLSearchParams(
    (["onglet", "ligue", "competition"] as const).flatMap((k) => {
      const value = paramText(query[k]);
      return value ? [[k, value]] : [];
    }),
  );
  const here = `/classement${asked.size ? `?${asked}` : ""}`;
  const user = await getCurrentUser();

  const [{ coming, past }, leagues] = await Promise.all([loadCompetitions(), loadMyLeagues()]);
  const all = [...coming, ...past];
  const today = parisDay(new Date().toISOString());
  const tonight = competitionDay(all, today);
  const tabs: Tab[] = !user
    ? ["general"]
    : tonight
      ? ["ligue", "soir", "general"]
      : ["ligue", "general"];
  const tab = tabs.find((t) => t === paramText(query.onglet)) ?? tabs[0]!;
  const league = leagues.find((l) => l.id === paramText(query.ligue)) ?? leagues[0] ?? null;
  const chosen =
    tab === "general" ? (all.find((c) => c.slug === paramText(query.competition)) ?? null) : null;

  const client = await getSessionClient();
  const ranking = createSupabaseRankingRepository(client);
  const scope =
    tab === "ligue"
      ? all.filter((c) => league?.competitionSlugs.includes(c.slug))
      : chosen
        ? [chosen]
        : all;
  const start = tab === "soir" ? null : rankingStart(scope, today);
  let rows: RankingRow[] | "error" = [];
  try {
    if (tab === "ligue" && league) {
      rows = await getLeagueRanking({
        ranking,
        leagues: createSupabaseLeagueRepository(client),
      }).execute({ leagueId: league.id, competitionSlugs: league.competitionSlugs });
    } else if (tab !== "ligue") {
      rows = await getGeneralRanking({ ranking }).execute({
        competitionSlugs: scope.map((c) => c.slug),
        day: tab === "soir" ? (tonight ?? undefined) : undefined,
      });
    }
  } catch (error) {
    if (!(error instanceof UseCaseError)) throw error;
    rows = "error";
  }
  const meId = user?.userId;
  const me = rows === "error" ? undefined : rows.find((r) => r.userId === meId);
  // A league is short: shown whole. The other rankings show the top and the player's neighbours.
  const shown = rows === "error" ? [] : tab === "ligue" ? rows : rankingWindow(rows, meId ?? null);

  return (
    <main id="main" className="flex flex-1 flex-col">
      <LeagueHero
        title={text.title}
        subtitle={
          tab === "ligue"
            ? league
              ? text.subtitle.ligue(league.name)
              : text.tabs.ligue
            : chosen
              ? text.subtitle.competition(chosen.name)
              : text.subtitle[tab]
        }
      />
      <div className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 py-5">
        <CompetitionChips
          label={text.scopeLabel}
          chips={tabs.map((t) => ({
            key: t,
            href: `/classement?onglet=${t}`,
            name: text.tabs[t],
            active: t === tab,
          }))}
        />
        {tab === "ligue" && leagues.length > 1 && (
          <CompetitionChips
            label={text.leaguesLabel}
            chips={leagues.map((l) => ({
              key: l.id,
              href: `/classement?onglet=ligue&ligue=${l.id}`,
              name: l.name,
              active: l.id === league?.id,
            }))}
          />
        )}

        {rows === "error" ? (
          <ErrorNotice retryHref={here} message={messages.errors.RANKING_UNAVAILABLE} />
        ) : tab === "ligue" && !league ? (
          <section className="flex flex-col gap-3 rounded-card bg-muted p-4">
            <p>{text.noLeague}</p>
            <div className="flex gap-2">
              <Link href="/ligues/creer" className={`${buttonVariants()} flex-1`}>
                {text.createLeague}
              </Link>
              <Link
                href="/ligues/rejoindre"
                className={`${buttonVariants({ variant: "outline" })} flex-1`}
              >
                {text.joinLeague}
              </Link>
            </div>
          </section>
        ) : (
          <>
            {start ? (
              <section className="flex flex-col gap-3 rounded-card bg-brand p-4 text-brand-foreground">
                <p className="font-display text-lg font-extrabold">{text.starts(start.startsOn)}</p>
                <p className="font-semibold">{text.inDays(start.days)}</p>
                <Link href="/epreuves" className={`${buttonVariants()} w-full`}>
                  {text.startCta}
                </Link>
              </section>
            ) : (
              <RankingPodium rows={rows} meId={meId} />
            )}
            {tab === "soir" && rows.length === 0 ? (
              <p className="rounded-card bg-muted p-4 text-muted-foreground">{text.tonightEmpty}</p>
            ) : (
              <Leaderboard rows={shown} meId={meId} retryHref={here} />
            )}
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
              !start &&
              rows.length > 0 &&
              (me ? (
                <p className="sticky bottom-20 flex items-center justify-between gap-3 rounded-2xl bg-foreground px-3.5 py-2 font-extrabold text-background shadow-lg md:bottom-3">
                  <span>{text.you(me.rank, me.points)}</span>
                  <a
                    href="#moi"
                    className="inline-flex min-h-11 items-center rounded-full px-3 underline underline-offset-4"
                  >
                    {text.aroundMe}
                  </a>
                </p>
              ) : (
                <p className="rounded-card bg-muted p-4 text-sm text-muted-foreground">
                  {text.notRanked}
                </p>
              ))
            )}
            {user && !start && !me && tab !== "ligue" && (
              <Link href="/epreuves" className={`${buttonVariants()} w-full`}>
                {text.predict}
              </Link>
            )}
          </>
        )}
      </div>
    </main>
  );
}
