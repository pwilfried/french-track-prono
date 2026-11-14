import Link from "next/link";
import { notFound } from "next/navigation";

import { UseCaseError } from "@/application/errors";
import { getManagerDuel, type ManagerDuelView } from "@/application/manager-duel";
import { ErrorNotice } from "@/components/error-notice";
import { LeagueHero } from "@/components/leagues/league-hero";
import { DuelStadium } from "@/components/manager/duel-stadium";
import {
  createSupabaseManagerCatalogue,
  createSupabaseManagerDuelRepository,
  createSupabaseManagerSeasonRepository,
} from "@/infra";

import { messages } from "../../../../../messages.fr";
import { getSessionClient } from "../../../../../session";
import { managerPorts } from "../../../../data";

const text = messages.managerDuel;
const championship = messages.managerChampionship;

/**
 * « Une confrontation » (#605), as in the validated mock-up « Confrontation stade contre stade »
 * (#775): back to the matchday under the league's name, the matchday live or over and the events
 * still to come, the two stadiums with each athlete's points, then the result, the leg and the
 * predictions. Every participant of the league reads it once the competition is locked; the
 * lineups stay secret before.
 */
export default async function ManagerDuelPage({
  params,
}: {
  params: Promise<{ id: string; round: string; home: string }>;
}) {
  const { id, round: param, home } = await params;
  const round = Number(param);
  if (!Number.isInteger(round) || round < 1) notFound();
  const path = `/manager/${id}/confrontation/${param}/${home}`;
  const ports = await managerPorts(path);
  const client = await getSessionClient();
  let view: ManagerDuelView | "error";
  try {
    view = await getManagerDuel({
      ...ports,
      season: createSupabaseManagerSeasonRepository(client),
      duels: createSupabaseManagerDuelRepository(client),
      catalogue: createSupabaseManagerCatalogue(client),
    }).execute({ leagueId: id, round, home });
  } catch (error) {
    if (!(error instanceof UseCaseError)) throw error;
    if (error.code === "LEAGUE_NOT_FOUND" || error.code === "MATCHDAY_NOT_FOUND") notFound();
    view = "error";
  }

  const back = {
    href: `/manager/${id}/journee/${param}`,
    label: championship.matchdayTitle(round),
  };
  if (view === "error") {
    return (
      <main id="main" className="flex flex-1 flex-col">
        <LeagueHero title={text.title} subtitle={text.subtitle(round)} back={back} />
        <div className="mx-auto w-full max-w-md px-4 py-6">
          <ErrorNotice retryHref={path} message={messages.errors.MANAGER_SEASON_UNAVAILABLE} />
        </div>
      </main>
    );
  }

  const { top, bottom } = view;
  const details = [
    text.leg[view.leg],
    view.mine ? text.venue(bottom.home) : null,
    view.competitionName,
  ].filter(Boolean);
  const live = bottom.score === null;
  const toCome = new Set(
    [...top.cards, ...bottom.cards]
      .filter((c) => c !== null && c.points === null)
      .map((c) => c!.discipline),
  ).size;

  return (
    <main id="main" className="flex flex-1 flex-col">
      <div className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 py-6 md:max-w-3xl">
        <header className="flex flex-col gap-2">
          <h1 className="sr-only">{text.title}</h1>
          <Link
            href={back.href}
            className="inline-flex min-h-11 items-center gap-1 self-start font-display text-xl font-extrabold text-nuit dark:text-foreground"
          >
            <span aria-hidden>‹</span>
            <span className="break-words">{view.leagueName}</span>
          </Link>
          <p className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-sm">
            <span className="text-muted-foreground">
              {view.locked ? text.day(view.round, live) : text.subtitle(view.round)}
            </span>
            {view.locked && toCome > 0 && (
              <span className="font-mono font-semibold text-nuit dark:text-foreground">
                {text.eventsToCome(toCome)}
              </span>
            )}
          </p>
        </header>

        {view.locked ? (
          <DuelStadium
            places={view.places}
            mine={view.mine}
            top={{
              pseudo: top.participant.pseudo,
              linedUp: top.linedUp,
              score: top.score,
              cards: top.cards,
            }}
            bottom={{
              pseudo: bottom.participant.pseudo,
              linedUp: bottom.linedUp,
              score: bottom.score,
              cards: bottom.cards,
            }}
          />
        ) : (
          <p role="status" className="rounded-card bg-muted p-4 text-sm font-semibold">
            🔒 {text.secret}
          </p>
        )}

        <section
          aria-label={text.summary}
          className="flex flex-col gap-1 rounded-card bg-muted p-4 text-sm"
        >
          <p className="font-bold">
            {view.outcome
              ? text.outcome(view.outcome.outcome, view.outcome.points)
              : !view.mine && view.result
                ? championship.result(view.result)
                : `${top.participant.pseudo} ${championship.vs} ${bottom.participant.pseudo}`}
          </p>
          <p className="text-muted-foreground">{details.join(" · ")}</p>
          {bottom.predictions !== null && top.predictions !== null && (
            <p className="text-muted-foreground">
              {text.predictions(
                view.mine ? text.you : bottom.participant.pseudo,
                bottom.predictions,
                view.mine ? text.opponent : top.participant.pseudo,
                top.predictions,
              )}
            </p>
          )}
        </section>

        <Link
          href={`/manager/${id}/classement`}
          className="inline-flex min-h-11 items-center font-semibold text-brand dark:text-secondary"
        >
          {championship.standingsLink} ›
        </Link>
      </div>
    </main>
  );
}
