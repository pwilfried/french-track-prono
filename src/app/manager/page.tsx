import Link from "next/link";

import { UseCaseError } from "@/application/errors";
import {
  listMyManagerLeagues,
  listPublicManagerLeagues,
  type ManagerLeague,
  type PublicManagerLeague,
} from "@/application/manager-leagues";
import { ErrorNotice } from "@/components/error-notice";
import { LeagueHero } from "@/components/leagues/league-hero";
import { buttonVariants } from "@/components/ui/button";
import { MANAGER_LEAGUE_MAX } from "@/domain/manager-league";

import { messages } from "../messages.fr";
import { managerPorts } from "./data";
import { JoinPublicManagerLeagueForm } from "./join-forms";

const text = messages.manager;

/** French Track Manager (#419): the player's Manager leagues and a way to create one. */
export default async function ManagerPage() {
  const ports = await managerPorts("/manager");
  let leagues: ManagerLeague[] | "error";
  let publics: PublicManagerLeague[] = [];
  try {
    [leagues, publics] = await Promise.all([
      listMyManagerLeagues(ports).execute(),
      listPublicManagerLeagues(ports).execute(),
    ]);
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
                  aria-label={league.name}
                  aria-describedby={`league-${league.id}-meta`}
                  className="flex min-h-16 flex-col justify-center rounded-card border border-border bg-card p-3.5"
                >
                  <span className="break-words font-extrabold">{league.name}</span>
                  <span id={`league-${league.id}-meta`} className="text-sm text-muted-foreground">
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
        <Link
          href="/manager/rejoindre"
          className={`${buttonVariants({ variant: "muted" })} w-full`}
        >
          {text.joinWithCode}
        </Link>

        {leagues !== "error" && (
          <section aria-labelledby="public-manager" className="flex flex-col gap-2 pt-4">
            <h2
              id="public-manager"
              className="border-b border-border pb-1 text-xs font-bold uppercase tracking-wide text-muted-foreground"
            >
              {text.publicTitle}
            </h2>
            {publics.length === 0 ? (
              <p className="rounded-card bg-muted p-4 text-sm text-muted-foreground">
                {text.publicEmpty}
              </p>
            ) : (
              <ul aria-labelledby="public-manager" className="flex flex-col gap-2">
                {publics.map((league) => (
                  <li
                    key={league.id}
                    className="flex min-h-16 items-center gap-3 rounded-card border border-border bg-card p-3.5"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block break-words font-extrabold">{league.name}</span>
                      <span className="block text-sm text-muted-foreground">
                        {text.participantsCount(league.memberCount, MANAGER_LEAGUE_MAX)}
                      </span>
                    </span>
                    <JoinPublicManagerLeagueForm id={league.id} name={league.name} />
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
