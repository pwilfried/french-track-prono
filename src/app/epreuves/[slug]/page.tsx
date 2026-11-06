import Link from "next/link";
import { notFound } from "next/navigation";

import { UseCaseError } from "@/application/errors";
import { getEvent } from "@/application/get-event";
import { buttonVariants } from "@/components/ui/button";
import { PodiumDisplay } from "@/components/podium/podium-display";
import type { EventDetail } from "@/domain/event";
import { initialsOf } from "@/domain/podium";
import { createPublicSupabaseClient, createSupabaseEventReader } from "@/infra";

import { messages } from "../../messages.fr";

const COMPETITION_SLUG = "ultimate-championship-2026";
const COMPETITION_TIME_ZONE = "Europe/Budapest";

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

export default async function EventPage({ params }: { params: Promise<{ slug: string }> }) {
  const loaded = await loadEvent((await params).slug);

  if (loaded === "error") {
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 py-8">
        <div role="alert" className="flex flex-col items-start gap-3 rounded-card bg-muted p-4">
          <p>{messages.errors.EVENTS_UNAVAILABLE}</p>
          <Link href="/epreuves" className={buttonVariants({ variant: "outline" })}>
            {messages.errors.retry}
          </Link>
        </div>
      </main>
    );
  }

  const event = loaded;
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
    <main className="flex flex-1 flex-col">
      <header className="hero px-4 pt-6">
        <div className="mx-auto max-w-md">
          <Link
            href="/epreuves"
            className="inline-flex min-h-11 items-center text-base font-semibold"
          >
            ‹ {messages.event.back}
          </Link>
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
          <div className="mt-6">
            <PodiumDisplay results={event.results} />
          </div>
        </div>
      </header>

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
    </main>
  );
}
