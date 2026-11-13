import Link from "next/link";
import { notFound } from "next/navigation";

import { UseCaseError } from "@/application/errors";
import {
  getManagerLeague,
  mercatoLaunch,
  type ManagerLeagueFile,
} from "@/application/manager-leagues";
import { ErrorNotice } from "@/components/error-notice";
import { LeagueHero } from "@/components/leagues/league-hero";
import { ShareInvite } from "@/components/leagues/share-invite";
import { Bib } from "@/components/profile/bib";
import { buttonVariants } from "@/components/ui/button";
import { utcToParis } from "@/domain/competition";
import {
  duelDays,
  mercatoEndsAt,
  playersAwaited,
  seasonShape,
  seasonStart,
} from "@/domain/manager-league";
import { roundEndsAt, roundHours } from "@/domain/manager-round";

import { messages } from "../../messages.fr";
import { managerPorts } from "../data";
import { LaunchMercatoForm, MercatoSettingsForm } from "../mercato-form";

/** How many rounds the calendar shows. */
const CALENDAR_ROUNDS = 3;

const text = messages.manager;

/**
 * A Manager league (#419): its participants « N/cible », its mercato (set and launched by its
 * creator, #619), its competitions and the season they make (#644), its frozen rules.
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
  const now = new Date().toISOString();
  const launch = mercatoLaunch(league, now);
  const awaited = playersAwaited(launch);
  const isOwner = league.ownerId === ports.userId;
  const open = mercato.openedAt !== null;
  const calendarStart = mercato.openedAt ?? mercato.startsAt;
  const shape = seasonShape(league.competitions.length);
  // The season as the mercato set would make it: opening at its time, or now if launched now.
  const plannedStart =
    mercato.startsAt && Date.parse(mercato.startsAt) > Date.parse(now) ? mercato.startsAt : now;
  const season = seasonStart(
    league.competitions,
    mercato.target,
    mercatoEndsAt(plannedStart, rules.rounds, rules.minTeamSize),
  );
  const notices = [
    ...(season.missed
      ? [
          text.firstMissed(
            season.missed.name,
            text.day(season.missed.startsAt),
            season.first?.name ?? null,
          ),
        ]
      : []),
    ...(season.short > 0 ? [text.competitionsShort(season.short)] : []),
  ];
  // Launched now: the competitions the home-and-away season would lack.
  const shortNow = Math.max(0, duelDays(mercato.target) - launch.counted);
  const waiting =
    awaited > 0 ? text.launchWaiting(awaited) : shortNow > 0 ? text.launchShort : null;

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
          className={`flex flex-col gap-1 rounded-2xl px-3.5 py-3 text-sm font-semibold ${open || waiting === null ? "bg-success/15 text-success-text" : "bg-muted text-foreground"}`}
        >
          {open ? (
            <p>{text.mercatoOpened(text.when(mercato.openedAt!))}</p>
          ) : (
            <>
              <p>
                {awaited > 0
                  ? text.awaited(awaited)
                  : shortNow > 0
                    ? text.competitionsShortNow(shortNow)
                    : text.ready}
              </p>
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
            <MercatoSettingsForm
              leagueId={league.id}
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
              notices={notices}
            />
            <LaunchMercatoForm leagueId={league.id} waiting={waiting} />
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
            {Array.from({ length: CALENDAR_ROUNDS }, (_, i) => i + 1).map((n) => (
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
          </ul>
        </section>

        <section aria-labelledby="competitions" className="flex flex-col gap-2">
          <h2
            id="competitions"
            className="text-xs font-bold uppercase tracking-wide text-muted-foreground"
          >
            {text.competitionsTitle}
          </h2>
          {shape && (
            <p className="text-sm font-semibold">
              {text.seasonLine(league.competitions.length, shape)}
            </p>
          )}
          <ol
            aria-labelledby="competitions"
            className="flex flex-col gap-1 rounded-card bg-muted p-4 text-sm"
          >
            {league.competitions.map((c) => (
              <li key={c.id}>
                <span className="font-semibold">{c.name}</span>
                <span className="text-muted-foreground"> · {text.day(c.startsAt)}</span>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </main>
  );
}
