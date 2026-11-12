import Link from "next/link";

import { UseCaseError } from "@/application/errors";
import {
  listMyManagerLeagues,
  listPublicManagerLeagues,
  type ManagerLeague,
  type PublicManagerLeague,
} from "@/application/manager-leagues";
import { getManagerRules } from "@/application/manager-rules";
import { ErrorNotice } from "@/components/error-notice";
import { LeagueHero } from "@/components/leagues/league-hero";
import { ManagerIntro } from "@/components/manager/manager-intro";
import { buttonVariants } from "@/components/ui/button";
import { managerIntroFigures, type ManagerIntroFigures } from "@/domain/manager-intro";
import { MANAGER_LEAGUE_MAX } from "@/domain/manager-league";
import { createSupabaseManagerRuleRepository } from "@/infra";

import { messages } from "../messages.fr";
import { getSessionClient } from "../session";
import { managerPorts } from "./data";
import { JoinPublicManagerLeagueForm } from "./join-forms";

const text = messages.manager;

/** « Passer » on the presentation: the page as if the player had seen it. */
const SKIP_HREF = "/manager?passer=1";

/**
 * French Track Manager (#419): the player's Manager leagues and a way to create one. Until the
 * player has one, the presentation of the mode comes first (#618).
 */
export default async function ManagerPage({
  searchParams,
}: {
  searchParams: Promise<{ passer?: string | string[] }>;
}) {
  const ports = await managerPorts("/manager");
  const { passer } = await searchParams;
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

  if (leagues !== "error" && leagues.length === 0 && passer === undefined) {
    const figures = await introFigures();
    // Without the rules there are no figures to quote: the page itself, as before.
    if (figures) {
      return (
        <main id="main" className="flex flex-1 flex-col">
          <ManagerIntro figures={figures} skipHref={SKIP_HREF} />
        </main>
      );
    }
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
                {/* The player's own public leagues are not listed (#496). */}
                {leagues.some((league) => league.isPublic) ? text.publicNoOther : text.publicEmpty}
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

async function introFigures(): Promise<ManagerIntroFigures | undefined> {
  try {
    const rules = createSupabaseManagerRuleRepository(await getSessionClient());
    const { rules: current } = await getManagerRules({ rules }).execute();
    return managerIntroFigures(current);
  } catch (error) {
    if (!(error instanceof UseCaseError)) throw error;
    return undefined;
  }
}
