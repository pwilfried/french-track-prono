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
import { CompetitionChips } from "@/components/events/competition-chips";
import { Leaderboard } from "@/components/leaderboard/leaderboard";
import { Podium } from "@/components/leaderboard/podium";
import { LeagueHero } from "@/components/leagues/league-hero";
import { buttonVariants } from "@/components/ui/button";
import { rankingStart } from "@/domain/competition";
import { createSupabaseLeagueRepository, createSupabaseRankingRepository } from "@/infra";

import { currentCompetitionDay, currentDay, loadCompetitions, loadMyLeagues } from "../competition";
import { messages } from "../messages.fr";
import { paramText } from "../search-params";
import { getCurrentUser, getSessionClient } from "../session";

const VIEWS = ["ligue", "soir", "general"] as const;
type View = (typeof VIEWS)[number];

/** The address of a view of the ranking, with its league or competition when there is one. */
function hrefOf(view: View, extra: { ligue?: string; competition?: string } = {}) {
  const query = new URLSearchParams({ vue: view });
  if (extra.ligue) query.set("ligue", extra.ligue);
  if (extra.competition) query.set("competition", extra.competition);
  return `/classement?${query}`;
}

/**
 * The rankings tab (#551): « Ma ligue » first (the player's first league, a chooser when they have
 * several), « Ce soir » (points of tonight's finals, hidden before the first competition) and
 * « Général » (every player, or one competition with ?competition=), cut around the player.
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
  const views = user ? VIEWS.filter((v) => v !== "soir" || !start) : (["general"] as const);
  const view = views.find((v) => v === paramText(query.vue)) ?? views[0]!;
  const chosen =
    view === "general" ? (all.find((c) => c.slug === paramText(query.competition)) ?? null) : null;

  const leagues = user ? await loadMyLeagues() : [];
  const league: League | null =
    view === "ligue"
      ? (leagues.find((l) => l.id === paramText(query.ligue)) ?? leagues[0] ?? null)
      : null;
  const here = hrefOf(view, { ligue: league?.id, competition: chosen?.slug });

  const today = currentCompetitionDay();
  const client = await getSessionClient();
  const ranking = createSupabaseRankingRepository(client);
  let rows: RankingRow[] | "error" | null = null;
  try {
    if (view === "ligue" && league) {
      rows = await getLeagueRanking({
        ranking,
        leagues: createSupabaseLeagueRepository(client),
      }).execute({
        leagueId: league.id,
        competitionSlugs: league.competitionSlugs,
        families: league.families,
        today,
      });
    } else if (view === "soir") {
      rows = await getTonightRanking({ ranking }).execute({
        competitionSlugs: all.map((c) => c.slug),
        today,
      });
    } else if (view === "general") {
      rows = await getGeneralRanking({ ranking }).execute({
        competitionSlugs: chosen ? [chosen.slug] : all.map((c) => c.slug),
        today,
      });
    }
  } catch (error) {
    if (!(error instanceof UseCaseError)) throw error;
    rows = "error";
  }
  const meId = user?.userId;
  const me = Array.isArray(rows) ? rows.find((p) => p.userId === meId) : undefined;
  const text = messages.ranking;
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
        <CompetitionChips
          label={text.viewLabel}
          chips={views.map((v) => ({
            key: v,
            href: hrefOf(v),
            name: text.view[v],
            active: v === view,
          }))}
        />
        {view === "ligue" && leagues.length > 1 && (
          <CompetitionChips
            label={text.leagueLabel}
            chips={leagues.map((l) => ({
              key: l.id,
              href: hrefOf("ligue", { ligue: l.id }),
              name: l.name,
              active: l.id === league?.id,
            }))}
          />
        )}
        {view === "general" && (
          <CompetitionChips
            label={text.scopeLabel}
            chips={[{ slug: null, name: text.general }, ...all].map((c) => ({
              key: c.slug ?? "general",
              href: hrefOf("general", { competition: c.slug ?? undefined }),
              name: c.name,
              active: (c.slug ?? null) === (chosen?.slug ?? null),
            }))}
          />
        )}

        {start && (
          <section className="flex flex-col gap-3 rounded-card bg-brand p-4 text-brand-foreground">
            <p className="font-display text-lg font-extrabold">
              {text.starts(start.startsOn, start.days)}
            </p>
            <Link href="/epreuves" className={`${buttonVariants()} w-full`}>
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
