import Link from "next/link";
import { notFound } from "next/navigation";

import { UseCaseError } from "@/application/errors";
import { getManagerStandings, type ManagerStandingsView } from "@/application/manager-championship";
import { ErrorNotice } from "@/components/error-notice";
import { LeagueHero } from "@/components/leagues/league-hero";
import { Bib } from "@/components/profile/bib";
import { createSupabaseManagerSeasonRepository } from "@/infra";

import { messages } from "../../../messages.fr";
import { getSessionClient } from "../../../session";
import { managerPorts } from "../../data";

const text = messages.managerChampionship;
const { columns, columnLabels } = text;

/**
 * « Classement » (#433): the standings of the championship (rank, player, W, D, L, difference,
 * points), the player's line highlighted, the tie rule, then the player's next head-to-head.
 * Once the season is over, a link to its end (#434).
 */
export default async function ManagerStandingsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const path = `/manager/${id}/classement`;
  const ports = await managerPorts(path);
  let view: ManagerStandingsView | "error";
  try {
    view = await getManagerStandings({
      ...ports,
      season: createSupabaseManagerSeasonRepository(await getSessionClient()),
    }).execute({ leagueId: id });
  } catch (error) {
    if (!(error instanceof UseCaseError)) throw error;
    if (error.code === "LEAGUE_NOT_FOUND") notFound();
    view = "error";
  }

  return (
    <main id="main" className="flex flex-1 flex-col">
      <LeagueHero
        title={text.standingsTitle}
        subtitle={view === "error" ? text.standingsCaption : view.leagueName}
        back={{
          href: `/manager/${id}`,
          label: view === "error" ? messages.manager.back : view.leagueName,
        }}
      />
      <div className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 py-6">
        {view === "error" ? (
          <ErrorNotice retryHref={path} message={messages.errors.MANAGER_SEASON_UNAVAILABLE} />
        ) : (
          <>
            {view.ended && (
              <div
                role="status"
                className="flex flex-col gap-1 rounded-card bg-gold-soft p-4 text-sm font-semibold text-gold-ink"
              >
                <p>{text.ended}</p>
                <Link
                  href={`/manager/${id}/fin-de-saison`}
                  className="inline-flex min-h-11 items-center underline underline-offset-4"
                >
                  {text.endLink} ›
                </Link>
              </div>
            )}
            {!view.started && (
              <p role="status" className="rounded-card bg-muted p-4 text-sm font-semibold">
                {text.notStarted}
              </p>
            )}
            <table className="w-full border-separate border-spacing-y-1.5 text-sm">
              <caption className="sr-only">{text.standingsCaption}</caption>
              <thead>
                <tr className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  <th scope="col" className="w-8 px-1 text-left">
                    <abbr title={columns.rank} className="no-underline">
                      #
                    </abbr>
                  </th>
                  <th scope="col" className="px-1 text-left">
                    {columns.player}
                  </th>
                  {(["wins", "draws", "losses", "difference", "points"] as const).map((c) => (
                    <th key={c} scope="col" className="px-1 text-right">
                      <abbr title={columnLabels[c]} className="no-underline">
                        {columns[c]}
                      </abbr>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {view.rows.map((r) => {
                  const cell = r.mine ? "bg-primary-soft text-primary-ink" : "bg-card";
                  return (
                    <tr key={r.userId} aria-current={r.mine ? "true" : undefined}>
                      <td
                        className={`${cell} rounded-l-2xl px-2 py-2.5 font-display text-base font-extrabold`}
                      >
                        {r.rank}
                      </td>
                      <th scope="row" className={`${cell} px-1 py-2.5 text-left font-semibold`}>
                        <span className="flex min-w-0 items-center gap-2">
                          <Bib bib={r.participant.bib} />
                          <span className="min-w-0 break-words">
                            {r.participant.pseudo}
                            {r.mine && <span className="font-normal"> ({text.me})</span>}
                          </span>
                        </span>
                      </th>
                      <td className={`${cell} px-1 py-2.5 text-right`}>{r.wins}</td>
                      <td className={`${cell} px-1 py-2.5 text-right`}>{r.draws}</td>
                      <td className={`${cell} px-1 py-2.5 text-right`}>{r.losses}</td>
                      <td className={`${cell} px-1 py-2.5 text-right`}>
                        {text.difference(r.difference)}
                      </td>
                      <td
                        className={`${cell} rounded-r-2xl px-2 py-2.5 text-right font-display text-base font-extrabold`}
                      >
                        {r.points}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="text-xs text-muted-foreground">{text.tieRule}</p>

            {view.started && (
              <section
                aria-labelledby="next"
                className="flex flex-col gap-2 rounded-card bg-nuit p-4 text-white ring-1 ring-white/10"
              >
                {view.next ? (
                  <>
                    <h2
                      id="next"
                      className="text-xs font-bold uppercase tracking-wide text-white/70"
                    >
                      {text.nextTitle(view.next.round)}
                    </h2>
                    <p className="text-sm">
                      {view.next.competitionName} · {text.nextAgainst(view.next.home)}
                    </p>
                    <p className="flex items-center gap-2 font-display text-xl font-extrabold">
                      <Bib bib={view.next.opponent.bib} />
                      <span className="min-w-0 break-words">{view.next.opponent.pseudo}</span>
                    </p>
                  </>
                ) : (
                  <h2 id="next" className="text-sm font-semibold">
                    {text.noNext}
                  </h2>
                )}
                <Link
                  href={`/manager/${id}/journee`}
                  className="inline-flex min-h-11 items-center font-semibold text-secondary"
                >
                  {text.calendarLink} ›
                </Link>
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}
