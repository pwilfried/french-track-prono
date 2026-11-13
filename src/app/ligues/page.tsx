import Link from "next/link";

import { UseCaseError } from "@/application/errors";
import {
  listMyLeagues,
  listPublicLeagues,
  type League,
  type PublicLeague,
} from "@/application/leagues";
import { getLeagueRanking, standingIn } from "@/application/rankings";
import { ErrorNotice } from "@/components/error-notice";
import { DiscoverLeagues } from "@/components/leagues/discover-leagues";
import { JoinPublicLeagueForm, ReportLeagueForm } from "@/components/leagues/league-forms";
import { LeagueCard } from "@/components/leagues/league-card";
import { LeagueHero } from "@/components/leagues/league-hero";
import { OfficialLeague } from "@/components/leagues/official-league";
import { buttonVariants } from "@/components/ui/button";
import { publicLeaguesNotice } from "@/domain/league";
import { leagueSummary, nextLeagueCompetition } from "@/domain/league-list";
import { cn } from "@/lib/utils";

import { currentCompetitionDay, currentDay, loadCompetitions } from "../competition";
import { messages } from "../messages.fr";
import { paramText } from "../search-params";
import { leaguePorts } from "./data";

const text = messages.leagues;
type Tab = "mes-ligues" | "decouvrir";
type Row = { league: League; standing: ReturnType<typeof standingIn> };

/**
 * The « Ligues » tab (#662): « Créer une ligue » and « J'ai un code », then « Mes ligues · N »
 * (summed-up cards with my place) or « Découvrir » (the official league, then the public leagues
 * to search, filter by family and sort). The tab lives in the URL (`?onglet=decouvrir`).
 */
export default async function LeaguesPage({
  searchParams,
}: {
  searchParams: Promise<{ onglet?: string | string[] }>;
}) {
  const tab: Tab =
    paramText((await searchParams).onglet) === "decouvrir" ? "decouvrir" : "mes-ligues";
  const ports = await leaguePorts(tab === "decouvrir" ? "/ligues?onglet=decouvrir" : "/ligues");
  let mine: League[] = [];
  let rows: Row[] = [];
  let publics: PublicLeague[] = [];
  let failed = false;
  try {
    [mine, publics] = await Promise.all([
      listMyLeagues(ports).execute(),
      tab === "decouvrir" ? listPublicLeagues(ports).execute() : Promise.resolve([]),
    ]);
    if (tab === "mes-ligues") {
      // One ranking per league: fine for the few leagues a player is in.
      rows = await Promise.all(
        mine.map(async (league) => {
          const ranking = await getLeagueRanking(ports).execute({
            leagueId: league.id,
            competitionSlugs: league.competitionSlugs,
            families: league.families,
            today: currentCompetitionDay(),
          });
          return { league, standing: standingIn(ranking, ports.userId) };
        }),
      );
    }
  } catch (error) {
    if (!(error instanceof UseCaseError)) throw error;
    failed = true;
  }

  const { coming, past } = await loadCompetitions();
  const competitions = [...coming, ...past];
  const today = currentDay();
  // The official league has its own block above the public ones while the player is not in it.
  const official = publics.find((l) => l.isOfficial);
  const others = publics.filter((l) => !l.isOfficial);

  const tabs: { tab: Tab; label: string; href: string }[] = [
    { tab: "mes-ligues", label: text.listTabs.mine(mine.length), href: "/ligues" },
    { tab: "decouvrir", label: text.listTabs.discover, href: "/ligues?onglet=decouvrir" },
  ];

  return (
    <main id="main" className="flex flex-1 flex-col">
      <LeagueHero title={text.title} subtitle={text.listSubtitle} />
      <div className="mx-auto flex w-full max-w-md flex-col gap-3 px-4 py-6">
        <div className="grid grid-cols-2 gap-2">
          <Link href="/ligues/creer" className={`${buttonVariants()} px-3`}>
            {text.create}
          </Link>
          <Link
            href="/ligues/rejoindre"
            className={`${buttonVariants({ variant: "outline" })} px-3`}
          >
            {text.haveCode}
          </Link>
        </div>

        <nav aria-label={text.listTabsLabel} className="grid grid-cols-2 gap-2 pt-2">
          {tabs.map((t) => (
            <Link
              key={t.tab}
              href={t.href}
              aria-current={t.tab === tab ? "page" : undefined}
              className={cn(
                "inline-flex min-h-11 items-center justify-center whitespace-nowrap rounded-full px-4 font-semibold",
                t.tab === tab
                  ? "bg-brand text-brand-foreground dark:bg-secondary dark:text-secondary-foreground"
                  : "border border-border bg-background text-foreground",
              )}
            >
              {t.label}
            </Link>
          ))}
        </nav>

        {failed ? (
          <ErrorNotice
            retryHref={tabs.find((t) => t.tab === tab)!.href}
            message={messages.errors.LEAGUES_UNAVAILABLE}
          />
        ) : tab === "mes-ligues" ? (
          rows.length === 0 ? (
            <p className="rounded-card bg-muted p-4 text-sm text-muted-foreground">
              <strong className="block text-foreground">{text.emptyTitle}</strong>
              {text.emptyText}
            </p>
          ) : (
            <ul aria-label={text.myLeagues} className="flex flex-col gap-2">
              {rows.map(({ league, standing }) => (
                <li key={league.id}>
                  <LeagueCard
                    href={`/ligues/${league.id}`}
                    name={league.name}
                    memberCount={league.memberCount}
                    summary={leagueSummary(league.competitionSlugs, competitions)}
                    next={nextLeagueCompetition(league.competitionSlugs, competitions, today)}
                    isPublic={league.isPublic}
                    isOfficial={league.isOfficial}
                    families={league.families?.map((f) => f.family)}
                    standing={standing}
                  />
                </li>
              ))}
            </ul>
          )
        ) : (
          <>
            {official && (
              <OfficialLeague name={official.name} memberCount={official.memberCount}>
                <JoinPublicLeagueForm
                  leagueId={official.id}
                  name={official.name}
                  label={text.officialJoin(official.name)}
                />
              </OfficialLeague>
            )}
            <section aria-labelledby="public-leagues" className="flex flex-col gap-2 pt-2">
              <h2
                id="public-leagues"
                className="border-b border-border pb-1 text-xs font-bold uppercase tracking-wide text-muted-foreground"
              >
                {text.publicTitle}
              </h2>
              <DiscoverLeagues
                // The official league, shown above while I am not in it, is a public one too.
                notice={
                  text.publicNotice[
                    official
                      ? "no_other"
                      : publicLeaguesNotice(
                          mine.filter((l) => l.isPublic),
                          ports.userId,
                        )
                  ]
                }
                leagues={others.map((league) => ({
                  id: league.id,
                  name: league.name,
                  memberCount: league.memberCount,
                  createdAt: league.createdAt,
                  families: league.families,
                  summary: leagueSummary(league.competitionSlugs, competitions),
                  actions: (
                    <>
                      <JoinPublicLeagueForm leagueId={league.id} name={league.name} />
                      <ReportLeagueForm leagueId={league.id} name={league.name} />
                    </>
                  ),
                }))}
              />
            </section>
          </>
        )}
      </div>
    </main>
  );
}
