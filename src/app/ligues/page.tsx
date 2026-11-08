import Link from "next/link";

import { UseCaseError } from "@/application/errors";
import {
  listMyLeagues,
  listPublicLeagues,
  type League,
  type PublicLeague,
} from "@/application/leagues";
import { getLeagueRanking } from "@/application/rankings";
import { ErrorNotice } from "@/components/error-notice";
import { JoinPublicLeagueForm } from "@/components/leagues/league-forms";
import { LeagueHero } from "@/components/leagues/league-hero";
import { buttonVariants } from "@/components/ui/button";
import { PUBLIC_LEAGUE_MAX_MEMBERS } from "@/domain/league";

import { loadCompetitions } from "../competition";
import { messages } from "../messages.fr";
import { leaguePorts } from "./data";

type Row = { league: League; rank: number | null };

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
        });
        return { league, rank: ranking.find((p) => p.userId === ports.userId)?.rank ?? null };
      }),
    );
  } catch (error) {
    if (!(error instanceof UseCaseError)) throw error;
    rows = "error";
  }

  const { coming, past } = await loadCompetitions();
  const nameOf = new Map([...coming, ...past].map((c) => [c.slug, c.name]));

  return (
    <main id="main" className="flex flex-1 flex-col">
      <LeagueHero title={messages.leagues.title} subtitle={messages.leagues.listSubtitle} />
      <div className="mx-auto flex w-full max-w-md flex-col gap-3 px-4 py-6">
        {rows === "error" ? (
          <ErrorNotice retryHref="/ligues" message={messages.errors.LEAGUES_UNAVAILABLE} />
        ) : rows.length === 0 ? (
          <p className="rounded-card bg-muted p-4 text-sm text-muted-foreground">
            <strong className="block text-foreground">{messages.leagues.emptyTitle}</strong>
            {messages.leagues.emptyText}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {rows.map(({ league, rank }) => (
              <li key={league.id}>
                <Link
                  href={`/ligues/${league.id}`}
                  className="flex min-h-16 items-center gap-3 rounded-card border border-border bg-card p-3.5"
                >
                  <span
                    aria-hidden
                    className="grid size-11 shrink-0 place-items-center rounded-2xl bg-muted text-2xl"
                  >
                    🏆
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block break-words font-extrabold">
                      {league.name}
                      {league.isPublic && (
                        <span className="ml-2 rounded-full bg-secondary px-2 py-0.5 align-middle text-xs font-bold text-secondary-foreground">
                          {messages.leagues.publicBadge}
                        </span>
                      )}
                    </span>
                    <span className="block text-sm text-muted-foreground">
                      {messages.leagues.members(league.memberCount)}
                      {league.ownerId === ports.userId ? ` · ${messages.leagues.createdByMe}` : ""}
                    </span>
                  </span>
                  {rank !== null && (
                    <span className="shrink-0 text-right text-sm font-bold">
                      {messages.leagues.rankOf(rank, league.memberCount)}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
        <Link href="/ligues/creer" className={`${buttonVariants()} w-full`}>
          {messages.leagues.create}
        </Link>
        <Link href="/ligues/rejoindre" className={`${buttonVariants({ variant: "muted" })} w-full`}>
          {messages.leagues.join}
        </Link>
        <Link href="/classement" className={`${buttonVariants({ variant: "outline" })} w-full`}>
          {messages.leagues.general}
        </Link>

        {rows !== "error" && (
          <section aria-labelledby="public-leagues" className="flex flex-col gap-2 pt-4">
            <h2
              id="public-leagues"
              className="border-b border-border pb-1 text-xs font-bold uppercase tracking-wide text-muted-foreground"
            >
              {messages.leagues.publicTitle}
            </h2>
            {publics.length === 0 ? (
              <p className="rounded-card bg-muted p-4 text-sm text-muted-foreground">
                {messages.leagues.publicEmpty}
              </p>
            ) : (
              <ul aria-labelledby="public-leagues" className="flex flex-col gap-2">
                {publics.map((league) => (
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
                          ...league.competitionSlugs.map((slug) => nameOf.get(slug) ?? slug),
                        ].join(" · ")}
                      </span>
                    </span>
                    <JoinPublicLeagueForm leagueId={league.id} name={league.name} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
