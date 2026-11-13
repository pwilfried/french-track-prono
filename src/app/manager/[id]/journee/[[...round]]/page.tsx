import Link from "next/link";
import { notFound } from "next/navigation";

import { UseCaseError } from "@/application/errors";
import {
  getManagerMatchday,
  type ManagerMatchdayView,
  type MatchdayDuel,
} from "@/application/manager-championship";
import { ErrorNotice } from "@/components/error-notice";
import { LeagueHero } from "@/components/leagues/league-hero";
import { Bib } from "@/components/profile/bib";
import { createSupabaseManagerSeasonRepository } from "@/infra";

import { messages } from "../../../../messages.fr";
import { getSessionClient } from "../../../../session";
import { managerPorts } from "../../../data";

const text = messages.managerChampionship;

function DuelSide({
  player,
  score,
  winner,
  align,
}: {
  player: MatchdayDuel["home"];
  score: number | null;
  winner: boolean;
  align: "start" | "end";
}) {
  return (
    <div
      className={`flex min-w-0 flex-1 flex-col gap-1 ${align === "end" ? "items-end text-right" : "items-start"}`}
    >
      <Bib bib={player.bib} />
      <span className="max-w-full break-words text-sm font-semibold">{player.pseudo}</span>
      <span
        className={`font-display text-3xl font-extrabold leading-none ${winner ? "" : "text-muted-foreground"}`}
      >
        {text.score(score)}
      </span>
    </div>
  );
}

function DuelCard({ duel }: { duel: MatchdayDuel }) {
  return (
    <li
      aria-label={duel.mine ? text.myDuel : text.duelLabel(duel.home.pseudo, duel.away.pseudo)}
      className={`flex flex-col gap-2 rounded-card bg-card p-4 ${duel.mine ? "border-2 border-primary" : "border border-border"}`}
    >
      {duel.mine && (
        <span className="text-xs font-bold uppercase tracking-wide text-accent-text">
          {text.myDuel}
        </span>
      )}
      <div className="flex items-start gap-3">
        <DuelSide
          player={duel.home}
          score={duel.homeScore}
          winner={duel.result !== "away"}
          align="start"
        />
        <span aria-hidden="true" className="self-center text-xs font-bold text-muted-foreground">
          {text.vs}
        </span>
        <DuelSide
          player={duel.away}
          score={duel.awayScore}
          winner={duel.result !== "home"}
          align="end"
        />
      </div>
      <p className="text-sm font-semibold">{text.result(duel.result)}</p>
    </li>
  );
}

/**
 * « La journée » (#433): the row of matchdays, then the head-to-heads of one of them with their
 * scores and results, the player's first. A bonus matchday has none.
 */
export default async function ManagerMatchdayPage({
  params,
}: {
  params: Promise<{ id: string; round?: string[] }>;
}) {
  const { id, round: segments } = await params;
  if (segments && segments.length > 1) notFound();
  const param = segments?.[0];
  const round = param === undefined ? undefined : Number(param);
  if (round !== undefined && (!Number.isInteger(round) || round < 1)) notFound();
  const path = `/manager/${id}/journee${param ? `/${param}` : ""}`;
  const ports = await managerPorts(path);
  let view: ManagerMatchdayView | "not_started" | "error";
  try {
    view = await getManagerMatchday({
      ...ports,
      season: createSupabaseManagerSeasonRepository(await getSessionClient()),
    }).execute({ leagueId: id, round });
  } catch (error) {
    if (!(error instanceof UseCaseError)) throw error;
    if (error.code === "LEAGUE_NOT_FOUND" || error.code === "MATCHDAY_NOT_FOUND") notFound();
    view = error.code === "MANAGER_SEASON_NOT_STARTED" ? "not_started" : "error";
  }

  const back = { href: `/manager/${id}`, label: messages.manager.back };
  if (typeof view === "string") {
    return (
      <main id="main" className="flex flex-1 flex-col">
        <LeagueHero title={text.matchdayLink} subtitle={text.matchdays} back={back} />
        <div className="mx-auto w-full max-w-md px-4 py-6">
          {view === "error" ? (
            <ErrorNotice retryHref={path} message={messages.errors.MANAGER_SEASON_UNAVAILABLE} />
          ) : (
            <p role="status" className="rounded-card bg-muted p-4 text-sm font-semibold">
              {messages.errors.MANAGER_SEASON_NOT_STARTED}
            </p>
          )}
        </div>
      </main>
    );
  }

  const details = [
    view.competitionName ?? text.noCompetition,
    view.leg && text.leg[view.leg],
    view.duels.length > 0 && text.duelCount(view.duels.length),
    text.state[view.state],
  ].filter(Boolean);

  return (
    <main id="main" className="flex flex-1 flex-col">
      <LeagueHero
        title={text.matchdayTitle(view.round)}
        subtitle={view.leagueName}
        back={{ href: `/manager/${id}`, label: view.leagueName }}
      />
      <div className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 py-6">
        <nav aria-label={text.matchdays} className="-mx-4 overflow-x-auto px-4">
          <ol className="flex gap-2">
            {view.matchdays.map((m) => {
              const current = m.round === view.round;
              return (
                <li key={m.round}>
                  <Link
                    href={`/manager/${id}/journee/${m.round}`}
                    aria-label={text.matchdayTabLabel(m.round)}
                    aria-current={current ? "page" : undefined}
                    className={`grid min-h-11 min-w-11 place-items-center rounded-full px-3 text-sm font-bold ${
                      current
                        ? "bg-nuit text-white"
                        : m.state === "bonus"
                          ? "bg-gold-soft text-gold-ink"
                          : "bg-muted text-foreground"
                    }`}
                  >
                    {text.matchdayTab(m.round)}
                  </Link>
                </li>
              );
            })}
          </ol>
        </nav>

        <p className="text-sm text-muted-foreground">{details.join(" · ")}</p>

        {view.state === "bonus" ? (
          <p
            role="status"
            className="rounded-card bg-gold-soft p-4 text-sm font-semibold text-gold-ink"
          >
            {text.bonusText}
          </p>
        ) : view.state === "not_played" ? (
          <p role="status" className="rounded-card bg-muted p-4 text-sm font-semibold">
            {text.notPlayedText}
          </p>
        ) : (
          <section aria-labelledby="duels" className="flex flex-col gap-2">
            <h2
              id="duels"
              className="text-xs font-bold uppercase tracking-wide text-muted-foreground"
            >
              {text.duels}
            </h2>
            <ul aria-labelledby="duels" className="flex flex-col gap-2">
              {view.duels.map((d) => (
                <DuelCard key={d.home.userId} duel={d} />
              ))}
            </ul>
          </section>
        )}

        <Link
          href={`/manager/${id}/classement`}
          className="inline-flex min-h-11 items-center font-semibold text-brand dark:text-secondary"
        >
          {text.standingsLink} ›
        </Link>
      </div>
    </main>
  );
}
