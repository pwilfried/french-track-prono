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
import { JoinPublicLeagueForm, ReportLeagueForm } from "@/components/leagues/league-forms";
import { LeagueCard } from "@/components/leagues/league-card";
import { LeagueHero } from "@/components/leagues/league-hero";
import { OfficialLeague } from "@/components/leagues/official-league";
import { buttonVariants } from "@/components/ui/button";
import { PUBLIC_LEAGUE_MAX_MEMBERS } from "@/domain/league";

import { currentCompetitionDay, loadCompetitions } from "../competition";
import { messages } from "../messages.fr";
import { leaguePorts } from "./data";

type Row = { league: League; standing: ReturnType<typeof standingIn> };

export default async function LeaguesPage() {
  const ports = await leaguePorts("/ligues");
  let rows: Row[] | "error";
  let publics: PublicLeague[] = [];
  try {
    publics = await listPublicLeagues(ports).execute();
    const mine = await listMyLeagues(ports).execute();
    // One ranking per league: fine for the few leagues a player is in.
    rows = await Promise.all(
      mine.map(async (league) => {
        const ranking = await getLeagueRanking(ports).execute({
          leagueId: league.id,
          competitionSlugs: league.competitionSlugs,
          today: currentCompetitionDay(),
        });
        return { league, standing: standingIn(ranking, ports.userId) };
      }),
    );
  } catch (error) {
    if (!(error instanceof UseCaseError)) throw error;
    rows = "error";
  }

  // The official league has its own block above the public ones while the player is not in it.
  const official = publics.find((l) => l.isOfficial);
  const others = publics.filter((l) => !l.isOfficial);
  const { coming, past } = await loadCompetitions();
  const nameOf = new Map([...coming, ...past].map((c) => [c.slug, c.name]));
  const namesOf = (slugs: string[]) => slugs.map((slug) => nameOf.get(slug) ?? slug);

  return (
    <main id="main" className="flex flex-1 flex-col">
      <LeagueHero title={messages.leagues.title} subtitle={messages.leagues.listSubtitle} />
      <div className="mx-auto flex w-full max-w-md flex-col gap-3 px-4 py-6">
        <div className="grid grid-cols-2 gap-2">
          <Link href="/ligues/creer" className={`${buttonVariants()} px-3`}>
            {messages.leagues.create}
          </Link>
          <Link
            href="/ligues/rejoindre"
            className={`${buttonVariants({ variant: "outline" })} px-3`}
          >
            {messages.leagues.haveCode}
          </Link>
        </div>

        {rows === "error" ? (
          <ErrorNotice retryHref="/ligues" message={messages.errors.LEAGUES_UNAVAILABLE} />
        ) : rows.length === 0 ? (
          <p className="rounded-card bg-muted p-4 text-sm text-muted-foreground">
            <strong className="block text-foreground">{messages.leagues.emptyTitle}</strong>
            {messages.leagues.emptyText}
          </p>
        ) : (
          <ul aria-label={messages.leagues.myLeagues} className="flex flex-col gap-2">
            {rows.map(({ league, standing }) => (
              <li key={league.id}>
                <LeagueCard
                  href={`/ligues/${league.id}`}
                  name={league.name}
                  memberCount={league.memberCount}
                  competitionNames={namesOf(league.competitionSlugs)}
                  isPublic={league.isPublic}
                  isOfficial={league.isOfficial}
                  standing={standing}
                />
              </li>
            ))}
          </ul>
        )}

        {rows !== "error" && official && (
          <OfficialLeague name={official.name} memberCount={official.memberCount}>
            <JoinPublicLeagueForm
              leagueId={official.id}
              name={official.name}
              label={messages.leagues.officialJoin(official.name)}
            />
          </OfficialLeague>
        )}
        {rows !== "error" && (
          <section aria-labelledby="public-leagues" className="flex flex-col gap-2 pt-4">
            <h2
              id="public-leagues"
              className="border-b border-border pb-1 text-xs font-bold uppercase tracking-wide text-muted-foreground"
            >
              {messages.leagues.publicTitle}
            </h2>
            {others.length === 0 ? (
              <p className="rounded-card bg-muted p-4 text-sm text-muted-foreground">
                {messages.leagues.publicEmpty}
              </p>
            ) : (
              <ul aria-labelledby="public-leagues" className="flex flex-col gap-2">
                {others.map((league) => (
                  <li
                    key={league.id}
                    className="flex min-h-16 items-center gap-3 rounded-card border border-border bg-card p-3.5"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block break-words font-extrabold">{league.name}</span>
                      <span className="block text-sm text-muted-foreground">
                        {[
                          messages.leagues.publicPlaces(
                            league.memberCount,
                            PUBLIC_LEAGUE_MAX_MEMBERS,
                          ),
                          ...namesOf(league.competitionSlugs),
                        ].join(" · ")}
                      </span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end">
                      <JoinPublicLeagueForm leagueId={league.id} name={league.name} />
                      <ReportLeagueForm leagueId={league.id} name={league.name} />
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {/* Its place is decided in #471; until then, a discreet link here. */}
        <Link
          href="/manager"
          className="mx-auto inline-flex min-h-11 items-center text-sm font-semibold text-muted-foreground underline underline-offset-4"
        >
          {messages.manager.entry}
        </Link>
      </div>
    </main>
  );
}
