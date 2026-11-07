import Link from "next/link";

import { UseCaseError } from "@/application/errors";
import { listMyLeagues, type League } from "@/application/leagues";
import { getLeagueRanking } from "@/application/rankings";
import { ErrorNotice } from "@/components/error-notice";
import { LeagueHero } from "@/components/leagues/league-hero";
import { buttonVariants } from "@/components/ui/button";

import { COMPETITION_SLUG, COMPETITION_TEXT } from "../competition";
import { messages } from "../messages.fr";
import { leaguePorts } from "./data";

type Row = { league: League; rank: number | null };

export default async function LeaguesPage() {
  const ports = await leaguePorts("/ligues");
  let rows: Row[] | "error";
  try {
    const mine = await listMyLeagues(ports).execute();
    // One ranking per league: fine for the few leagues a player is in.
    rows = await Promise.all(
      mine.map(async (league) => {
        const ranking = await getLeagueRanking(ports).execute({
          leagueId: league.id,
          competitionSlug: COMPETITION_SLUG,
        });
        return { league, rank: ranking.find((p) => p.userId === ports.userId)?.rank ?? null };
      }),
    );
  } catch (error) {
    if (!(error instanceof UseCaseError)) throw error;
    rows = "error";
  }

  return (
    <main className="flex flex-1 flex-col">
      <LeagueHero title={messages.leagues.title} subtitle={COMPETITION_TEXT.name} />
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
                    <span className="block break-words font-extrabold">{league.name}</span>
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
      </div>
    </main>
  );
}
