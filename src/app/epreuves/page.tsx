import Link from "next/link";

import { listEvents } from "@/application/list-events";
import { listMyPredictions } from "@/application/list-my-predictions";
import { UseCaseError } from "@/application/errors";
import { AccountMenu } from "@/components/account/account-menu";
import { ErrorNotice } from "@/components/error-notice";
import { EventCard, type MyEventState } from "@/components/events/event-card";
import { GenderFilter } from "@/components/events/gender-filter";
import type { EventGender, EventSummary } from "@/domain/event";
import { filterByGender, groupEventsByDay } from "@/domain/event-list";
import {
  createPublicSupabaseClient,
  createSupabaseEventReader,
  createSupabasePredictionRepository,
} from "@/infra";

import { COMPETITION_SLUG, COMPETITION_TEXT, COMPETITION_TIME_ZONE } from "../competition";
import { messages } from "../messages.fr";
import { getCurrentUser, getSessionClient } from "../session";

const genders: EventGender[] = ["F", "M", "X"];

function parseGender(value: string | string[] | undefined): EventGender | null {
  return genders.find((gender) => gender === value) ?? null;
}

async function loadEvents(): Promise<EventSummary[] | "error"> {
  try {
    const events = createSupabaseEventReader(createPublicSupabaseClient());
    return await listEvents({ events }).execute({ competitionSlug: COMPETITION_SLUG });
  } catch (error) {
    // Only known error codes are expected here; anything else is a bug and stays visible.
    if (error instanceof UseCaseError) return "error";
    throw error;
  }
}

/**
 * The signed-in player's predictions by event id; null for a visitor, or when they cannot be read
 * (the list still shows, without the marks).
 */
async function loadMine(): Promise<Map<string, MyEventState> | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  try {
    const predictions = createSupabasePredictionRepository(await getSessionClient());
    const mine = await listMyPredictions({ predictions }).execute({
      userId: user.userId,
      competitionSlug: COMPETITION_SLUG,
    });
    const byEvent = new Map<string, MyEventState>(
      mine.map((p) => [p.eventId, { predicted: true, joker: p.useJoker }]),
    );
    return byEvent;
  } catch (error) {
    if (error instanceof UseCaseError) return null;
    throw error;
  }
}

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<{ genre?: string | string[] }>;
}) {
  const gender = parseGender((await searchParams).genre);
  const [loaded, mine] = await Promise.all([loadEvents(), loadMine()]);
  const events = loaded === "error" ? [] : loaded;
  const days = groupEventsByDay(filterByGender(events, gender), COMPETITION_TIME_ZONE);
  const dayLabel = new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: COMPETITION_TIME_ZONE,
  });

  return (
    <main className="flex flex-1 flex-col">
      <header className="hero px-4 pb-6 pt-8">
        <div className="mx-auto max-w-md">
          <div className="flex items-center justify-between gap-3">
            <Link
              href="/"
              className="inline-flex min-h-11 shrink-0 items-center gap-3 whitespace-nowrap text-sm font-bold uppercase"
            >
              <span className="-rotate-3 rounded-lg bg-primary px-2.5 py-1 text-primary-foreground">
                {messages.app.short}
              </span>
              {messages.app.name}
            </Link>
            <AccountMenu returnTo="/epreuves" />
          </div>
          <h1 className="mt-2 font-display text-3xl font-extrabold uppercase leading-none">
            {COMPETITION_TEXT.name}
          </h1>
          <p className="mt-2 text-[#dce6f5]">
            {loaded === "error"
              ? COMPETITION_TEXT.place
              : messages.events.subtitle(COMPETITION_TEXT.place, events.length)}
          </p>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-md flex-col gap-5 px-4 py-5">
        <GenderFilter selected={gender} />

        {loaded === "error" ? (
          <ErrorNotice retryHref="/epreuves" />
        ) : days.length === 0 ? (
          <p className="rounded-card bg-muted p-4">{messages.events.empty}</p>
        ) : (
          days.map(({ day, events: dayEvents }) => (
            <section key={day} aria-labelledby={`day-${day}`} className="flex flex-col gap-2">
              <h2
                id={`day-${day}`}
                className="text-sm font-bold uppercase tracking-wide text-muted-foreground"
              >
                {dayLabel.format(new Date(`${day}T12:00:00Z`))}
              </h2>
              <ul className="flex flex-col gap-2">
                {dayEvents.map((event) => (
                  <EventCard
                    key={event.id}
                    event={event}
                    timeZone={COMPETITION_TIME_ZONE}
                    mine={
                      mine ? (mine.get(event.id) ?? { predicted: false, joker: false }) : undefined
                    }
                  />
                ))}
              </ul>
            </section>
          ))
        )}

        <p className="rounded-card bg-muted p-4 text-sm text-muted-foreground">
          {messages.events.provisionalTimes}
        </p>
      </div>
    </main>
  );
}
