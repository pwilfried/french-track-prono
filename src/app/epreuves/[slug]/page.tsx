import Link from "next/link";

import { notFound } from "next/navigation";

import { UseCaseError } from "@/application/errors";
import { getEvent } from "@/application/get-event";
import { getEventOdds } from "@/application/set-event-odds";
import { getMyPrediction, type Prediction } from "@/application/save-prediction";
import { buttonVariants } from "@/components/ui/button";
import { LockBanner } from "@/components/countdown/lock-banner";
import { ErrorNotice } from "@/components/error-notice";
import { PodiumMedals } from "@/components/podium/podium-medals";
import { PodiumPicker, type PickerAthlete } from "@/components/podium/podium-picker";
import { eventPhase } from "@/domain/countdown";
import type { EventDetail } from "@/domain/event";
import { formatMark } from "@/domain/discipline";
import { flagOf } from "@/domain/flag";
import { pickChoices } from "@/domain/odds";
import { canPredictRound } from "@/domain/rounds";
import { draftFromPodium, emptyDraft } from "@/domain/podium-draft";
import {
  createPublicSupabaseClient,
  createSupabaseEventReader,
  createSupabaseOddsRepository,
  createSupabasePredictionRepository,
  type CurrentUser,
} from "@/infra";

import { currentCompetition } from "../../competition";
import { messages } from "../../messages.fr";
import { getCurrentUser, getSessionClient } from "../../session";
import { PredictionForm } from "./prediction-form";
import { ResultSection } from "./result-section";
import { RevealHidden, RevealSection } from "./reveal-section";

async function loadEvent(slug: string): Promise<EventDetail | "error"> {
  try {
    const events = createSupabaseEventReader(createPublicSupabaseClient());
    // Event slugs are unique: the event opens whatever its competition.
    return await getEvent({ events }).execute({ competitionSlug: null, eventSlug: slug });
  } catch (error) {
    if (error instanceof UseCaseError) {
      if (error.code === "EVENT_NOT_FOUND") notFound();
      return "error";
    }
    throw error;
  }
}

/**
 * What the picker offers: the start list, or with odds the proposed athletes and « autre
 * athlète »; null while the odds of a competition that plays with them are not set.
 */
async function loadChoices(event: EventDetail): Promise<PickerAthlete[] | null> {
  if (!event.oddsRequired) return event.entries;
  try {
    const odds = createSupabaseOddsRepository(createPublicSupabaseClient());
    const found = await getEventOdds({ odds }).execute({ eventId: event.id });
    if (!found.odds) return null;
    return pickChoices(event.entries, found.odds, found.marks, messages.picker.other);
  } catch (error) {
    if (error instanceof UseCaseError) return null;
    throw error;
  }
}

/** The player's prediction, null when none, "error" when it cannot be read. */
async function loadMyPrediction(
  userId: string,
  eventId: string,
): Promise<Prediction | null | "error"> {
  try {
    const predictions = createSupabasePredictionRepository(await getSessionClient());
    return await getMyPrediction({ predictions }).execute({ userId, eventId });
  } catch (error) {
    if (error instanceof UseCaseError) return "error";
    throw error;
  }
}

async function PredictionSection({
  event,
  slug,
  user,
  open,
  choices,
}: {
  event: EventDetail;
  slug: string;
  user: CurrentUser | null;
  open: boolean;
  choices: PickerAthlete[] | null;
}) {
  const back = `/epreuves/${slug}`;

  // A final opens once its semi-finals are run: the start list is only known then.
  if (open && !canPredictRound(event.round, event.previousRounds)) {
    return <p className="mx-4 rounded-card bg-muted p-4">{messages.errors.ROUND_NOT_READY}</p>;
  }
  if (!choices) {
    return open ? (
      <p className="mx-4 rounded-card bg-muted p-4">{messages.errors.ODDS_NOT_READY}</p>
    ) : null;
  }

  if (!user) {
    return (
      <div className="mx-4 flex flex-col gap-3 rounded-card bg-muted p-4">
        <p>
          <strong className="block">{messages.prediction.visitorTitle}</strong>
          {messages.prediction.visitorText}
        </p>
        <Link
          href={`/connexion?next=${encodeURIComponent(back)}`}
          className={`${buttonVariants()} w-full`}
        >
          {messages.prediction.signIn}
        </Link>
      </div>
    );
  }

  const mine = await loadMyPrediction(user.userId, event.id);
  if (mine === "error") return <ErrorNotice retryHref={back} />;
  const draft = mine ? draftFromPodium(mine.podium) : emptyDraft();
  const unit = event.markUnit;
  const markText = (value: number | null | undefined) =>
    value != null && unit ? formatMark(value, unit) : "";
  const marks = {
    first: markText(mine?.marks?.first),
    second: markText(mine?.marks?.second),
    third: markText(mine?.marks?.third),
  };

  if (open) {
    return (
      <PredictionForm
        eventId={event.id}
        slug={slug}
        athletes={choices}
        initial={{ draft, useJoker: mine?.useJoker ?? false, marks }}
        markUnit={event.markUnit}
        tolerance={event.tolerance}
      />
    );
  }
  if (!mine) {
    return (
      <p className="mx-4 rounded-2xl bg-muted px-3.5 py-3 text-sm text-muted-foreground">
        {messages.prediction.none}
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      <PodiumPicker athletes={choices} initialDraft={draft} disabled />
      {mine.marks && (
        <dl className="mx-4 flex flex-col gap-1 rounded-2xl bg-muted px-3.5 py-3 text-sm">
          {(["first", "second", "third"] as const).map((slot) => {
            const name = choices.find((c) => c.athleteId === mine.podium[slot])?.name;
            return marks[slot] && name ? (
              <div key={slot} className="flex justify-between gap-3">
                <dt>{messages.picker.markLabel(name)}</dt>
                <dd className="font-mono font-bold">{marks[slot]}</dd>
              </div>
            ) : null;
          })}
        </dl>
      )}
      {mine.useJoker && (
        <p className="mx-4 rounded-2xl bg-secondary/20 px-3.5 py-3 font-extrabold">
          {messages.prediction.jokerUsedHere}
        </p>
      )}
    </div>
  );
}

export default async function EventPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ ligue?: string | string[] }>;
}) {
  const competition = await currentCompetition();
  const { slug } = await params;
  const { ligue } = await searchParams;
  const leagueId = typeof ligue === "string" && ligue !== "" ? ligue : undefined;
  const loaded = await loadEvent(slug);

  if (loaded === "error") {
    return (
      <main id="main" className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 py-8">
        <ErrorNotice retryHref={`/epreuves/${slug}`} />
      </main>
    );
  }

  const event = loaded;
  const [user, choices] = await Promise.all([getCurrentUser(), loadChoices(event)]);
  const open = eventPhase(new Date(), event.lockAt) === "open";
  // The picker already lists the athletes of an open event for a signed-in player.
  const showStartList = !(user && open);
  const when = new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: competition.timeZone,
  }).format(new Date(event.startsAt));
  const winner = event.results.find((result) => result.rank === 1);
  const markOf = new Map(event.results.map((result) => [result.athleteId, result.mark]));

  return (
    <main id="main" className="flex flex-1 flex-col">
      <header className="px-4 pt-4">
        <div className="mx-auto flex max-w-md flex-col gap-3">
          <Link
            href="/epreuves"
            className="inline-flex min-h-11 items-center self-start font-semibold text-brand dark:text-secondary"
          >
            ‹ {messages.event.back}
          </Link>
          <div>
            {winner && (
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {messages.result.eyebrow(event.discipline, messages.events.gender[event.gender])}
              </p>
            )}
            <h1 className="font-display text-3xl font-extrabold leading-tight">
              {winner
                ? messages.result.winner(winner.name)
                : messages.event.title(event.discipline)}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {messages.events.gender[event.gender]} ·{" "}
              <span className="first-letter:uppercase">{when.replace(" à ", " · ")}</span>
            </p>
          </div>
          {event.status === "upcoming" ? (
            <LockBanner lockAt={event.lockAt} />
          ) : (
            <span className="self-start rounded-full bg-muted px-3 py-1 text-xs font-bold">
              {messages.events.status[event.status]}
            </span>
          )}
          {event.subDisciplines.length > 0 && (
            <section aria-labelledby="combined-title" className="flex flex-col gap-2">
              <h2
                id="combined-title"
                className="text-xs font-bold uppercase tracking-wider text-muted-foreground"
              >
                {messages.event.combined(event.subDisciplines.length)}
              </h2>
              <ol className="flex flex-wrap gap-1.5">
                {event.subDisciplines.map((discipline, index) => (
                  <li
                    key={`${index}-${discipline}`}
                    className="rounded-full border border-border bg-card px-3 py-1 text-sm font-semibold"
                  >
                    <span className="font-mono text-xs text-muted-foreground">{index + 1}</span>{" "}
                    {discipline}
                  </li>
                ))}
              </ol>
              <p className="text-sm text-muted-foreground">{messages.event.combinedNote}</p>
            </section>
          )}
          {event.results.length > 0 && (
            <div className="rounded-card border border-border bg-card p-4">
              <PodiumMedals results={event.results} />
            </div>
          )}
        </div>
      </header>

      {event.previousRounds.length > 0 && (
        <details className="mx-auto mt-4 w-full max-w-md px-4">
          <summary className="flex min-h-11 cursor-pointer items-center font-bold">
            {messages.rounds.previous(event.previousRounds.length)}
          </summary>
          <div className="mt-2 flex flex-col gap-4">
            {event.previousRounds.map((round, index) => (
              <section key={round.slug} aria-label={messages.rounds.label(round.round, index + 1)}>
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  {messages.rounds.label(round.round, index + 1)} ·{" "}
                  {messages.events.status[round.status]}
                </h3>
                {round.results.length === 0 ? (
                  <p className="mt-1 text-sm text-muted-foreground">{messages.rounds.noResult}</p>
                ) : (
                  <ol className="mt-1 flex flex-col">
                    {round.results.map((r) => (
                      <li
                        key={r.athleteId}
                        className="flex min-h-11 items-center gap-3 border-b border-border py-1.5"
                      >
                        <span className="w-6 shrink-0 text-center font-mono text-sm text-muted-foreground">
                          {r.rank}
                        </span>
                        <span aria-hidden="true">{flagOf(r.countryCode)}</span>
                        <Link
                          href={`/athletes/${r.slug}`}
                          className="min-w-0 flex-1 break-words font-semibold"
                        >
                          {r.name}
                        </Link>
                        <span className="font-mono text-sm font-semibold tabular-nums">
                          {r.mark ?? ""}
                        </span>
                      </li>
                    ))}
                  </ol>
                )}
              </section>
            ))}
          </div>
        </details>
      )}

      <section className="mx-auto w-full max-w-md pt-6" aria-label={messages.picker.podium}>
        {user && winner ? (
          <ResultSection event={event} slug={slug} user={user} />
        ) : (
          <PredictionSection event={event} slug={slug} user={user} open={open} choices={choices} />
        )}
      </section>

      {user && (
        <section className="mx-auto w-full max-w-md pt-6">
          {open ? (
            <RevealHidden />
          ) : (
            <RevealSection event={event} slug={slug} user={user} leagueId={leagueId} />
          )}
        </section>
      )}

      {showStartList && (
        <div className="mx-auto flex w-full max-w-md flex-col gap-3 px-4 py-6">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            {messages.event.startList}
          </h2>
          {event.entries.length === 0 ? (
            <p className="rounded-card bg-muted p-4">{messages.event.startListEmpty}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {event.entries.map((entry) => (
                <li
                  key={entry.athleteId}
                  className="flex min-h-14 items-center gap-3 rounded-2xl border border-border bg-card px-3.5 py-2"
                >
                  <span
                    aria-hidden="true"
                    className="w-7 shrink-0 text-center text-xl leading-none"
                  >
                    {flagOf(entry.countryCode) ?? (
                      <span className="text-xs font-bold">{entry.countryCode}</span>
                    )}
                  </span>
                  <Link
                    href={`/athletes/${entry.slug}`}
                    className="min-w-0 flex-1 break-words font-bold underline-offset-2 hover:underline"
                  >
                    {entry.name}
                  </Link>
                  <span className="font-mono text-sm font-semibold tabular-nums">
                    {markOf.get(entry.athleteId) ?? entry.seasonBest ?? ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="rounded-card bg-muted p-4 text-sm text-muted-foreground">
            {messages.event.seedNote}
          </p>
        </div>
      )}
    </main>
  );
}
