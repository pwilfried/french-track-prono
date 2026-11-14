import Link from "next/link";

import { UseCaseError } from "@/application/errors";
import { listMySeasons, type MySeason } from "@/application/manager-home";
import {
  listMyManagerLeagues,
  listPublicManagerLeagues,
  type ManagerLeague,
  type PublicManagerLeague,
} from "@/application/manager-leagues";
import { getManagerRules } from "@/application/manager-rules";
import { ErrorNotice } from "@/components/error-notice";
import { LeagueHero } from "@/components/leagues/league-hero";
import { ManagerStart } from "@/components/manager/manager-home";
import { ManagerIntro } from "@/components/manager/manager-intro";
import { ManagerLeagueCard } from "@/components/manager/manager-league-card";
import { ManagerTutorialGate } from "@/components/manager/manager-tutorial";
import { buttonVariants } from "@/components/ui/button";
import { managerIntroFigures, type ManagerIntroFigures } from "@/domain/manager-intro";
import {
  createSupabaseManagerLineups,
  createSupabaseManagerRuleRepository,
  createSupabaseManagerSeasonRepository,
} from "@/infra";

import { messages } from "../messages.fr";
import { getSessionClient } from "../session";
import { managerPorts } from "./data";
import { JoinPublicManagerLeagueForm } from "./join-forms";

const text = messages.manager;

/** « Passer » on the presentation: the page as if the player had seen it. */
const SKIP_HREF = "/manager?passer=1";

/** « Comment ça marche ? »: the page with the tutorial open (#616). */
const TUTORIAL_HREF = "/manager?tutoriel=1";

/**
 * French Track Manager (#419): « Créer » and « Rejoindre », then the player's Manager leagues, one
 * card each with its phase, the player's place, the next deadline and what waits for them; a card
 * enters the league (#774). Until the player has one, the presentation of the mode comes first
 * (#618), then the mode in one line, the ways in and the steps. The tutorial opens over it at the
 * first visit, then on demand (#616).
 */
export default async function ManagerPage({
  searchParams,
}: {
  searchParams: Promise<{ passer?: string | string[]; tutoriel?: string | string[] }>;
}) {
  const ports = await managerPorts("/manager");
  const { passer, tutoriel } = await searchParams;
  let leagues: ManagerLeague[] | "error";
  let publics: PublicManagerLeague[] = [];
  // Without the rules there are no figures to quote: no presentation, no tutorial.
  let figures: ManagerIntroFigures | undefined;
  let seasons: MySeason[] | "error" = [];
  const now = new Date();
  try {
    [leagues, publics, figures, seasons] = await Promise.all([
      listMyManagerLeagues(ports).execute(),
      listPublicManagerLeagues(ports).execute(),
      introFigures(),
      mySeasons(ports, now),
    ]);
  } catch (error) {
    if (!(error instanceof UseCaseError)) throw error;
    leagues = "error";
  }
  const tutorial = figures && (
    // A new instance each time « Comment ça marche ? » asks for it again.
    <ManagerTutorialGate
      key={String(tutoriel !== undefined)}
      figures={figures}
      open={tutoriel !== undefined}
    />
  );

  if (leagues !== "error" && leagues.length === 0 && passer === undefined && figures) {
    return (
      <main id="main" className="flex flex-1 flex-col">
        <ManagerIntro figures={figures} skipHref={SKIP_HREF} />
        {tutorial}
      </main>
    );
  }

  return (
    <main id="main" className="flex flex-1 flex-col">
      {tutorial}
      <LeagueHero title={text.title} subtitle={text.slogan} />
      <div className="mx-auto flex w-full max-w-md flex-col gap-3 px-4 py-6">
        {leagues !== "error" && leagues.length === 0 ? (
          // The empty state: the mode in one line, « Créer » and « Rejoindre », the steps (#606).
          <ManagerStart />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2">
              <Link
                href="/manager/creer"
                className={`${buttonVariants()} h-auto min-h-11 whitespace-normal px-3 py-2 text-center`}
              >
                {text.create}
              </Link>
              <Link
                href="/manager/rejoindre"
                className={`${buttonVariants({ variant: "muted" })} h-auto min-h-11 whitespace-normal px-3 py-2 text-center`}
              >
                {text.joinWithCode}
              </Link>
            </div>
            {leagues === "error" ? (
              <ErrorNotice retryHref="/manager" message={messages.errors.LEAGUES_UNAVAILABLE} />
            ) : (
              <>
                <h2 className="pt-4 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  {text.mine}
                </h2>
                {seasons === "error" && (
                  <ErrorNotice
                    retryHref="/manager"
                    message={messages.errors.MANAGER_SEASON_UNAVAILABLE}
                  />
                )}
                <ul aria-label={text.mine} className="flex flex-col gap-2">
                  {leagues.map((league) => (
                    <li key={league.id}>
                      <ManagerLeagueCard
                        league={league}
                        season={
                          seasons === "error"
                            ? null
                            : (seasons.find((s) => s.leagueId === league.id) ?? null)
                        }
                        now={now}
                      />
                    </li>
                  ))}
                </ul>
              </>
            )}
          </>
        )}
        {figures && (
          <Link
            href={TUTORIAL_HREF}
            className="inline-flex min-h-11 items-center justify-center text-sm font-bold underline underline-offset-4"
          >
            {text.tutorial.open}
          </Link>
        )}

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
                        {text.participantsCount(league.memberCount, league.target)}
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

/** The season of each of the player's leagues (#774); their error does not hide the leagues. */
async function mySeasons(
  ports: Awaited<ReturnType<typeof managerPorts>>,
  now: Date,
): Promise<MySeason[] | "error"> {
  try {
    const client = await getSessionClient();
    return await listMySeasons({
      ...ports,
      season: createSupabaseManagerSeasonRepository(client),
      lineups: createSupabaseManagerLineups(client),
    }).execute({ now: now.toISOString() });
  } catch (error) {
    if (!(error instanceof UseCaseError)) throw error;
    return "error";
  }
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
