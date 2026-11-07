import Link from "next/link";

import { notFound } from "next/navigation";

import { UseCaseError } from "@/application/errors";
import { getEvent } from "@/application/get-event";
import { getMyPrediction, type Prediction } from "@/application/save-prediction";
import { buttonVariants } from "@/components/ui/button";
import { LockBanner } from "@/components/countdown/lock-banner";
import { ErrorNotice } from "@/components/error-notice";
import { PodiumMedals } from "@/components/podium/podium-medals";
import { PodiumPicker } from "@/components/podium/podium-picker";
import { eventPhase } from "@/domain/countdown";
import type { EventDetail } from "@/domain/event";
import { flagOf } from "@/domain/flag";
import { draftFromPodium, emptyDraft } from "@/domain/podium-draft";
import {
  createPublicSupabaseClient,
  createSupabaseEventReader,
  createSupabasePredictionRepository,
  type CurrentUser,
} from "@/infra";

import { COMPETITION_SLUG, COMPETITION_TIME_ZONE } from "../../competition";
import { messages } from "../../messages.fr";
import { getCurrentUser, getSessionClient } from "../../session";
import { PredictionForm } from "./prediction-form";
import { RevealHidden, RevealSection } from "./reveal-section";

async function loadEvent(slug: string): Promise<EventDetail | "error"> {
  try {
    const events = createSupabaseEventReader(createPublicSupabaseClient());
    return await getEvent({ events }).execute({
      competitionSlug: COMPETITION_SLUG,
      eventSlug: slug,
    });
  } catch (error) {
    if (error instanceof UseCaseError) {
      if (error.code === "EVENT_NOT_FOUND") notFound();
      return "error";
    }
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
}: {
  event: EventDetail;
  slug: string;
  user: CurrentUser | null;
  open: boolean;
}) {
  const back = `/epreuves/${slug}`;

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

  if (open) {
    return (
      <PredictionForm
        eventId={event.id}
        slug={slug}
        athletes={event.entries}
        initial={{ draft, useJoker: mine?.useJoker ?? false }}
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
      <PodiumPicker athletes={event.entries} initialDraft={draft} disabled />
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
  const user = await getCurrentUser();
  const open = eventPhase(new Date(), event.lockAt) === "open";
  // The picker already lists the athletes of an open event for a signed-in player.
  const showStartList = !(user && open);
  const when = new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: COMPETITION_TIME_ZONE,
  }).format(new Date(event.startsAt));
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
            <h1 className="font-display text-3xl font-extrabold leading-tight">
              {messages.event.title(event.discipline)}
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
          {event.results.length > 0 && (
            <div className="rounded-card border border-border bg-card p-4">
              <PodiumMedals results={event.results} />
            </div>
          )}
        </div>
      </header>

      <section className="mx-auto w-full max-w-md pt-6" aria-label={messages.picker.podium}>
        <PredictionSection event={event} slug={slug} user={user} open={open} />
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
                  <span className="min-w-0 flex-1 break-words font-bold">{entry.name}</span>
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
