import Link from "next/link";

import { UseCaseError } from "@/application/errors";
import { listMyManagerLeagues, type ManagerLeague } from "@/application/manager-leagues";
import { ErrorNotice } from "@/components/error-notice";
import { LeagueHero } from "@/components/leagues/league-hero";
import { buttonVariants } from "@/components/ui/button";
import { MANAGER_LEAGUE_MAX } from "@/domain/manager-league";

import { messages } from "../messages.fr";
import { managerPorts } from "./data";

const text = messages.manager;

/** French Track Manager (#419): the player's Manager leagues and a way to create one. */
export default async function ManagerPage() {
  const ports = await managerPorts("/manager");
  let leagues: ManagerLeague[] | "error";
  try {
    leagues = await listMyManagerLeagues(ports).execute();
  } catch (error) {
    if (!(error instanceof UseCaseError)) throw error;
    leagues = "error";
  }

  return (
    <main id="main" className="flex flex-1 flex-col">
      <LeagueHero title={text.title} subtitle={text.slogan} />
      <div className="mx-auto flex w-full max-w-md flex-col gap-3 px-4 py-6">
        <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
          {text.mine}
        </h2>
        {leagues === "error" ? (
          <ErrorNotice retryHref="/manager" message={messages.errors.LEAGUES_UNAVAILABLE} />
        ) : leagues.length === 0 ? (
          <p className="rounded-card bg-muted p-4 text-sm text-muted-foreground">{text.empty}</p>
        ) : (
          <ul aria-label={text.mine} className="flex flex-col gap-2">
            {leagues.map((league) => (
              <li key={league.id}>
                <Link
                  href={`/manager/${league.id}`}
                  className="flex min-h-16 flex-col justify-center rounded-card border border-border bg-card p-3.5"
                >
                  <span className="break-words font-extrabold">{league.name}</span>
                  <span className="text-sm text-muted-foreground">
                    {text.participantsCount(league.memberCount, MANAGER_LEAGUE_MAX)} ·{" "}
                    {league.isPublic ? text.publicBadge : text.privateBadge}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        <Link href="/manager/creer" className={`${buttonVariants()} w-full`}>
          {text.create}
        </Link>
      </div>
    </main>
  );
}
