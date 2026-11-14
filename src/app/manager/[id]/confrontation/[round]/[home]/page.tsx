import Link from "next/link";
import { notFound } from "next/navigation";

import { UseCaseError } from "@/application/errors";
import { getManagerDuel, type DuelSide, type ManagerDuelView } from "@/application/manager-duel";
import { ErrorNotice } from "@/components/error-notice";
import { LeagueHero } from "@/components/leagues/league-hero";
import { DuelStadium } from "@/components/manager/duel-stadium";
import { Bib } from "@/components/profile/bib";
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

function Player({ side, align }: { side: DuelSide; align: "start" | "end" }) {
  return (
    <div
      className={`flex min-w-0 flex-1 flex-col gap-1 ${align === "end" ? "items-end text-right" : "items-start"}`}
    >
      <Bib bib={side.participant.bib} />
      <span className="max-w-full break-words text-sm font-semibold">
        {side.participant.pseudo}
      </span>
      <span className="font-display text-3xl font-extrabold leading-none">
        {championship.score(side.score)}
      </span>
    </div>
  );
}

/**
 * « Une confrontation » (#605): the two players and their scores on the night blue, the result in
 * the middle, then the two stadiums face to face with each athlete's points (#775). Every participant of
 * the league reads it once the competition is locked; the lineups stay secret before.
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

  return (
    <main id="main" className="flex flex-1 flex-col">
      <LeagueHero title={text.title} subtitle={text.subtitle(view.round)} back={back} />
      <div className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 py-6 md:max-w-3xl">
        <section
          aria-label={text.summary}
          className="flex flex-col gap-3 rounded-card bg-nuit p-4 text-white ring-1 ring-white/10"
        >
          <div className="flex items-start gap-3">
            <Player side={top} align="start" />
            <p className="self-center text-center text-sm font-bold">
              {view.outcome
                ? text.outcome(view.outcome.outcome, view.outcome.points)
                : view.mine
                  ? championship.vs
                  : view.result
                    ? championship.result(view.result)
                    : championship.vs}
            </p>
            <Player side={bottom} align="end" />
          </div>
          <p className="text-xs font-semibold text-white/80">{details.join(" · ")}</p>
          {bottom.predictions !== null && top.predictions !== null && (
            <p className="text-xs text-white/80">
              {text.predictions(
                view.mine ? text.you : bottom.participant.pseudo,
                bottom.predictions,
                view.mine ? text.opponent : top.participant.pseudo,
                top.predictions,
              )}
            </p>
          )}
          {view.locked && bottom.score === null && (
            <p className="text-xs text-white/80">{championship.result(null)}</p>
          )}
        </section>

        {view.locked ? (
          <DuelStadium
            places={view.places}
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
