import Link from "next/link";
import { notFound } from "next/navigation";

import { UseCaseError } from "@/application/errors";
import {
  getManagerLeague,
  listSeasonCompetitions,
  mercatoLaunch,
  seasonFits,
  type ManagerLeagueFile,
  type SeasonCompetition,
} from "@/application/manager-leagues";
import { ErrorNotice } from "@/components/error-notice";
import { LeagueHero } from "@/components/leagues/league-hero";
import { ShareInvite } from "@/components/leagues/share-invite";
import { Bib } from "@/components/profile/bib";
import { buttonVariants } from "@/components/ui/button";
import { utcToParis } from "@/domain/competition";
import { PLANNED_ROUNDS, playersAwaited, seasonFormat } from "@/domain/manager-league";
import { roundEndsAt, roundHours } from "@/domain/manager-round";

import { messages } from "../../messages.fr";
import { managerPorts } from "../data";
import { CompetitionsForm, LaunchMercatoForm, MercatoSettingsForm } from "../mercato-form";

const text = messages.manager;

/** The league's competitions, then those still available it does not have, first one first. */
function competitionChoices(league: SeasonCompetition[], available: SeasonCompetition[]) {
  const ids = new Set(league.map((c) => c.id));
  return [...league, ...available.filter((c) => !ids.has(c.id))].sort((a, b) =>
    a.firstEventAt.localeCompare(b.firstEventAt),
  );
}

/**
 * A Manager league (#419): its participants « N/cible », its competitions and its mercato (set and
 * launched by its creator, #619, #644), its frozen rules.
 */
export default async function ManagerLeaguePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ports = await managerPorts(`/manager/${id}`);
  let league: ManagerLeagueFile | "error";
  try {
    league = await getManagerLeague(ports).execute({ id });
  } catch (error) {
    if (!(error instanceof UseCaseError)) throw error;
    if (error.code === "LEAGUE_NOT_FOUND") notFound();
    league = "error";
  }
  if (league === "error") {
    return (
      <main id="main" className="mx-auto w-full max-w-md px-4 py-6">
        <ErrorNotice retryHref={`/manager/${id}`} message={messages.errors.LEAGUES_UNAVAILABLE} />
      </main>
    );
  }

  const count = league.participants.length;
  const { mercato, rules } = league;
  const awaited = playersAwaited(mercatoLaunch(league));
  const isOwner = league.ownerId === ports.userId;
  const open = mercato.openedAt !== null;
  const calendarStart = mercato.openedAt ?? mercato.startsAt;
  const format = seasonFormat(league.competitions.length);
  // The creator may add competitions still available until the mercato opens.
  const available =
    isOwner && !open
      ? await listSeasonCompetitions(ports)
          .execute()
          .catch(() => [])
      : [];
  const short = !open && !seasonFits(league, new Date().toISOString());

  return (
    <main id="main" className="flex flex-1 flex-col">
      <LeagueHero
        title={league.name}
        subtitle={`${text.participantsCount(count, mercato.target)} · ${league.isPublic ? text.publicBadge : text.privateBadge}`}
        back={{ href: "/manager", label: text.back }}
        icon="🏟️"
      />
      <div className="mx-auto flex w-full max-w-md flex-col gap-5 px-4 py-6">
        <div
          role="status"
          className={`flex flex-col gap-1 rounded-2xl px-3.5 py-3 text-sm font-semibold ${open || awaited === 0 ? "bg-success/15 text-success-text" : "bg-muted text-foreground"}`}
        >
          {open ? (
            <p>{text.mercatoOpened(text.when(mercato.openedAt!))}</p>
          ) : (
            <>
              <p>{awaited === 0 ? text.ready : text.awaited(awaited)}</p>
              {mercato.startsAt && (
                <p className="font-normal">{text.opensAt(text.when(mercato.startsAt))}</p>
              )}
            </>
          )}
        </div>

        {isOwner && !open && (
          <section aria-labelledby="mercato" className="flex flex-col gap-3">
            <h2
              id="mercato"
              className="text-xs font-bold uppercase tracking-wide text-muted-foreground"
            >
              {text.mercatoTitle}
            </h2>
            <p className="text-sm text-muted-foreground">{text.mercatoHint}</p>
            <CompetitionsForm
              leagueId={league.id}
              competitions={competitionChoices(league.competitions, available)}
              chosen={league.competitions.map((c) => c.id)}
            />
            <MercatoSettingsForm
              leagueId={league.id}
              competitions={league.competitions}
              startsAt={mercato.startsAt ? utcToParis(mercato.startsAt) : ""}
              rounds={
                mercato.roundMode === "custom"
                  ? {
                      mode: "custom",
                      firstHours: rules.rounds.firstHours,
                      nextHours: rules.rounds.nextHours,
                    }
                  : { mode: "auto" }
              }
              autoHours={rules.rounds.firstHours}
            />
            <LaunchMercatoForm leagueId={league.id} awaited={awaited} short={short} />
          </section>
        )}

        <section aria-labelledby="calendar" className="flex flex-col gap-2">
          <h2
            id="calendar"
            className="text-xs font-bold uppercase tracking-wide text-muted-foreground"
          >
            {text.calendarTitle}
          </h2>
          <ol
            aria-labelledby="calendar"
            className="flex flex-col gap-1 rounded-card bg-muted p-4 text-sm"
          >
            {Array.from({ length: PLANNED_ROUNDS }, (_, i) => i + 1).map((n) => (
              <li key={n}>
                <span className="font-semibold">
                  {text.calendarRound(n, roundHours(rules.rounds, n))}
                </span>
                {calendarStart && (
                  <span className="text-muted-foreground">
                    {" "}
                    {text.calendarEnds(text.when(roundEndsAt(calendarStart, rules.rounds, n)))}
                  </span>
                )}
              </li>
            ))}
          </ol>
        </section>

        {isOwner && !open && !league.isPublic && (
          <section aria-labelledby="invite" className="flex flex-col gap-2">
            <h2
              id="invite"
              className="text-xs font-bold uppercase tracking-wide text-muted-foreground"
            >
              {text.inviteTitle}
            </h2>
            <ShareInvite
              code={league.inviteCode}
              leagueName={league.name}
              path={`/manager/rejoindre?code=${league.inviteCode}`}
              shareText={text.shareText(league.name)}
            />
          </section>
        )}

        <Link href={`/manager/${league.id}/catalogue`} className={`${buttonVariants()} w-full`}>
          {text.catalogueLink}
        </Link>
        <Link
          href={`/manager/${league.id}/equipe`}
          className={`${buttonVariants({ variant: "muted" })} w-full`}
        >
          {messages.team.link}
        </Link>
        <Link
          href={`/manager/${league.id}/alignement`}
          className={`${buttonVariants({ variant: "muted" })} w-full`}
        >
          {messages.lineup.link}
        </Link>

        <section aria-labelledby="participants" className="flex flex-col gap-2">
          <h2
            id="participants"
            className="text-xs font-bold uppercase tracking-wide text-muted-foreground"
          >
            {text.participants}
          </h2>
          <ol aria-labelledby="participants" className="flex flex-col gap-1.5">
            {league.participants.map((p) => (
              <li
                key={p.userId}
                className="flex min-h-12 items-center gap-3 rounded-2xl border border-border bg-card px-3.5"
              >
                <Bib bib={p.bib} />
                <span className="min-w-0 flex-1 break-words font-semibold">{p.pseudo}</span>
                {p.userId === league.ownerId && (
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-bold text-secondary-foreground">
                    {text.adminBadge}
                  </span>
                )}
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="rules" className="flex flex-col gap-2">
          <h2
            id="rules"
            className="text-xs font-bold uppercase tracking-wide text-muted-foreground"
          >
            {text.rules}
          </h2>
          <ul className="flex flex-col gap-1 rounded-card bg-muted p-4 text-sm">
            <li>{text.budget(rules.budget)}</li>
            <li>{text.minTeamSize(rules.minTeamSize)}</li>
            <li>{text.lineup(rules.lineup.max)}</li>
            <li>
              {format
                ? text.seasonFormat(
                    league.competitions.length,
                    format.players,
                    format.duelDays,
                    format.bonusDays,
                  )
                : text.competitions(league.competitions.length)}
            </li>
          </ul>
        </section>
      </div>
    </main>
  );
}
