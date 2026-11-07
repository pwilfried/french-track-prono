import Link from "next/link";

import { notFound } from "next/navigation";

import { AccountMenu } from "@/components/account/account-menu";

import { UseCaseError } from "@/application/errors";
import { getEvent } from "@/application/get-event";
import { getMyPrediction, type Prediction } from "@/application/save-prediction";
import { buttonVariants } from "@/components/ui/button";
import { CountdownBadge } from "@/components/countdown/countdown-badge";
import { ErrorNotice } from "@/components/error-notice";
import { PodiumDisplay } from "@/components/podium/podium-display";
import { PodiumPicker } from "@/components/podium/podium-picker";
import { eventPhase } from "@/domain/countdown";
import type { EventDetail } from "@/domain/event";
import { initialsOf } from "@/domain/podium";
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
      <p className="mx-4 rounded-2xl bg-muted px-3.5 py-3 text-sm text-muted-foreground">
        {messages.prediction.othersSoon}
      </p>
    </div>
  );
}

export default async function EventPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
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
      <header className="hero px-4 pt-6">
        <div className="mx-auto max-w-md">
          <div className="flex items-center justify-between gap-3">
            <Link
              href="/epreuves"
              className="inline-flex min-h-11 items-center text-base font-semibold"
            >
              ‹ {messages.event.back}
            </Link>
            <AccountMenu returnTo={`/epreuves/${slug}`} />
          </div>
          <h1 className="mt-1 flex flex-wrap items-center gap-2 font-display text-3xl font-extrabold uppercase leading-none">
            {event.discipline}
            <span className="rounded-full bg-primary px-3 py-1 font-sans text-sm font-extrabold text-primary-foreground">
              {messages.events.gender[event.gender]}
            </span>
          </h1>
          <p className="mt-2 flex flex-wrap items-center gap-2 text-[#dce6f5]">
            <span className="first-letter:uppercase">{when.replace(" à ", " · ")}</span>
            <span className="rounded-full bg-success-text px-3 py-0.5 text-xs font-bold text-white">
              {messages.events.status[event.status]}
            </span>
          </p>
          <div className="mt-4">
            <CountdownBadge lockAt={event.lockAt} />
          </div>
          <div className="mt-6">
            <PodiumDisplay results={event.results} />
          </div>
        </div>
      </header>

      <section className="mx-auto w-full max-w-md pt-6" aria-label={messages.picker.podium}>
        <PredictionSection event={event} slug={slug} user={user} open={open} />
      </section>

      {showStartList && (
        <div className="mx-auto flex w-full max-w-md flex-col gap-3 px-4 py-6">
          <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
            {messages.event.startList}
          </h2>
          {event.entries.length === 0 ? (
            <p className="rounded-card bg-muted p-4">{messages.event.startListEmpty}</p>
          ) : (
            <ul className="flex flex-col">
              {event.entries.map((entry) => (
                <li
                  key={entry.athleteId}
                  className="flex min-h-14 items-center gap-3 border-b border-border py-2"
                >
                  <span
                    aria-hidden="true"
                    className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-extrabold text-brand-foreground"
                  >
                    {initialsOf(entry.name)}
                  </span>
                  <span className="min-w-0 flex-1 break-words font-display text-lg font-bold">
                    {entry.name}
                  </span>
                  <span className="rounded-md bg-muted px-2 py-0.5 text-sm font-bold">
                    {entry.countryCode}
                  </span>
                  <span className="w-14 text-right text-lg font-bold">
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
