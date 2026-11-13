import Link from "next/link";
import { notFound } from "next/navigation";

import { UseCaseError } from "@/application/errors";
import { getManagerSeasonEnd, type ManagerSeasonEndView } from "@/application/manager-honours";
import { ErrorNotice } from "@/components/error-notice";
import { LeagueHero } from "@/components/leagues/league-hero";
import { TIME_ZONE } from "@/domain/competition";
import { createSupabaseManagerHonoursRepository } from "@/infra";

import { messages } from "../../../messages.fr";
import { getSessionClient } from "../../../session";
import { managerPorts } from "../../data";
import { StandingsTable } from "../../standings-table";

const text = messages.managerSeasonEnd;

const yearOf = (iso: string) =>
  Number(
    new Intl.DateTimeFormat("fr-FR", { year: "numeric", timeZone: TIME_ZONE }).format(
      new Date(iso),
    ),
  );

/**
 * « Fin de saison » (#434, board 10): the champion or the player's final place, the frozen final
 * standings (champion in gold), then « Ma saison »: Manager points, W · D · L, best athlete and
 * the record against the main rival.
 */
export default async function ManagerSeasonEndPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const path = `/manager/${id}/fin-de-saison`;
  const ports = await managerPorts(path);
  let view: ManagerSeasonEndView | "error";
  try {
    view = await getManagerSeasonEnd({
      ...ports,
      honours: createSupabaseManagerHonoursRepository(await getSessionClient()),
    }).execute({ leagueId: id });
  } catch (error) {
    if (!(error instanceof UseCaseError)) throw error;
    if (error.code === "LEAGUE_NOT_FOUND") notFound();
    view = "error";
  }

  return (
    <main id="main" className="flex flex-1 flex-col">
      <LeagueHero
        title={text.title}
        subtitle={view === "error" ? text.title : view.leagueName}
        back={{
          href: `/manager/${id}`,
          label: view === "error" ? messages.manager.back : view.leagueName,
        }}
      />
      <div className="mx-auto flex w-full max-w-md flex-col gap-5 px-4 py-6">
        {view === "error" ? (
          <ErrorNotice retryHref={path} message={messages.errors.MANAGER_HONOURS_UNAVAILABLE} />
        ) : !view.ended ? (
          <p role="status" className="rounded-card bg-muted p-4 text-sm font-semibold">
            {text.notOver}
          </p>
        ) : (
          <>
            <section
              aria-labelledby="verdict"
              className="flex flex-col items-center gap-2 rounded-card bg-nuit px-4 py-6 text-center text-white ring-1 ring-white/10"
            >
              <span aria-hidden="true" className="text-5xl">
                🏆
              </span>
              <h2 id="verdict" className="font-display text-2xl font-extrabold uppercase">
                {view.review
                  ? view.review.champion
                    ? text.champion
                    : text.place(view.review.rank, view.review.players)
                  : text.championOf(view.champion?.pseudo ?? "?")}
              </h2>
              <p className="text-sm text-white/80">
                {text.season(view.leagueName, yearOf(view.endedAt!))}
              </p>
              {view.review && (
                <p className="text-sm">
                  {text.summary(
                    view.review.champion,
                    view.review.wins,
                    view.review.wins + view.review.draws + view.review.losses,
                  )}
                </p>
              )}
            </section>

            <section aria-labelledby="final" className="flex flex-col gap-2">
              <h2
                id="final"
                className="text-xs font-bold uppercase tracking-wide text-muted-foreground"
              >
                {text.standingsTitle}
              </h2>
              <StandingsTable rows={view.rows} caption={text.standingsCaption} />
            </section>

            {view.review && (
              <section aria-labelledby="my-season" className="flex flex-col gap-2">
                <h2
                  id="my-season"
                  className="text-xs font-bold uppercase tracking-wide text-muted-foreground"
                >
                  {text.mySeason}
                </h2>
                <dl className="flex flex-col divide-y divide-border rounded-card border border-border bg-card">
                  {[
                    [text.managerPoints, `${view.review.managerPoints}`],
                    [
                      text.record,
                      text.recordValue(view.review.wins, view.review.draws, view.review.losses),
                    ],
                    [
                      text.bestAthlete,
                      view.review.bestAthlete
                        ? text.bestAthleteValue(
                            view.review.bestAthlete.name,
                            view.review.bestAthlete.points,
                          )
                        : text.noBestAthlete,
                    ],
                    ...(view.review.rival
                      ? [
                          [
                            text.rival(view.review.rival.participant.pseudo),
                            text.rivalValue(
                              view.review.rival.wins,
                              view.review.rival.draws,
                              view.review.rival.losses,
                            ),
                          ],
                        ]
                      : []),
                  ].map(([term, value]) => (
                    <div
                      key={term}
                      className="flex min-h-12 items-center justify-between gap-3 px-4 py-2"
                    >
                      <dt className="min-w-0 break-words text-sm text-muted-foreground">{term}</dt>
                      <dd className="text-right font-display text-base font-extrabold break-words">
                        {value}
                      </dd>
                    </div>
                  ))}
                </dl>
              </section>
            )}

            <p className="rounded-card bg-muted p-4 text-sm">{text.nextSeason}</p>
            <Link
              href="/profil"
              className="inline-flex min-h-11 items-center font-semibold text-primary underline underline-offset-4"
            >
              {text.honoursTitle} ›
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
