import { listEvents } from "@/application/list-events";
import { listMyPredictions } from "@/application/list-my-predictions";
import { UseCaseError } from "@/application/errors";
import { ErrorNotice } from "@/components/error-notice";
import { CompetitionPicker } from "@/components/events/competition-picker";
import { EventCard, type MyEventState } from "@/components/events/event-card";
import { GenderFilter } from "@/components/events/gender-filter";
import { InstallPrompt } from "@/components/shell/install-prompt";
import { TIME_ZONE } from "@/domain/competition";
import type { EventGender, EventSummary } from "@/domain/event";
import { filterByGender, groupEventsByDay } from "@/domain/event-list";
import {
  createPublicSupabaseClient,
  createSupabaseEventReader,
  createSupabasePredictionRepository,
} from "@/infra";

import { currentCompetition, playerCompetitions } from "../competition";
import { messages } from "../messages.fr";
import { paramText } from "../search-params";
import { getCurrentUser, getSessionClient } from "../session";

const genders: EventGender[] = ["F", "M", "X"];

function parseGender(value: string | string[] | undefined): EventGender | null {
  return genders.find((gender) => gender === value) ?? null;
}

async function loadEvents(slug?: string): Promise<EventSummary[] | "error"> {
  const competition = await currentCompetition(slug);
  try {
    const events = createSupabaseEventReader(createPublicSupabaseClient());
    return await listEvents({ events }).execute({ competitionSlug: competition.slug });
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
async function loadMine(slug?: string): Promise<Map<string, MyEventState> | null> {
  const competition = await currentCompetition(slug);
  const user = await getCurrentUser();
  if (!user) return null;
  try {
    const predictions = createSupabasePredictionRepository(await getSessionClient());
    const mine = await listMyPredictions({ predictions }).execute({
      userId: user.userId,
      competitionSlug: competition.slug,
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
  searchParams: Promise<{ genre?: string | string[]; competition?: string }>;
}) {
  const search = await searchParams;
  // A competition chosen (?competition=), else the next one of my leagues (#352).
  const choices = await playerCompetitions();
  const asked = paramText(search.competition) ?? choices.preferred;
  const competition = await currentCompetition(asked);
  const gender = parseGender(search.genre);
  const [loaded, mine] = await Promise.all([loadEvents(asked), loadMine(asked)]);
  const events = loaded === "error" ? [] : loaded;
  const counts = {
    all: events.length,
    F: filterByGender(events, "F").length,
    M: filterByGender(events, "M").length,
    X: filterByGender(events, "X").length,
  };
  const days = groupEventsByDay(filterByGender(events, gender));
  const dayLabel = new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: TIME_ZONE,
  });

  return (
    <main id="main" className="flex flex-1 flex-col">
      <header className="px-4 pb-1 pt-6">
        <div className="mx-auto max-w-md md:max-w-5xl">
          <h1 className="font-display text-3xl font-extrabold leading-none">
            {messages.nav.events}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {competition.name} ·{" "}
            {loaded === "error"
              ? competition.place
              : messages.events.subtitle(competition.place, events.length)}
          </p>
          <div className="mt-4">
            <CompetitionPicker
              mine={choices.mine}
              others={choices.others}
              selected={competition.slug}
            />
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-md flex-col gap-5 px-4 py-5 md:grid md:max-w-5xl md:grid-cols-[200px_1fr] md:items-start md:gap-8">
        <div className="md:sticky md:top-20">
          <GenderFilter selected={gender} counts={counts} competition={asked} />
        </div>
        <div className="flex flex-col gap-5">
          {loaded === "error" ? (
            <ErrorNotice retryHref="/epreuves" />
          ) : days.length === 0 ? (
            <p className="rounded-card bg-muted p-4">{messages.events.empty}</p>
          ) : (
            days.map(({ day, events: dayEvents }) => (
              <section key={day} aria-labelledby={`day-${day}`} className="flex flex-col gap-2">
                <h2
                  id={`day-${day}`}
                  className="border-b border-border pb-1 text-xs font-bold uppercase tracking-wide text-muted-foreground"
                >
                  {dayLabel.format(new Date(`${day}T12:00:00Z`))}
                </h2>
                <ul className="grid gap-2 md:grid-cols-2">
                  {dayEvents.map((event) => (
                    <EventCard
                      key={event.id}
                      event={event}
                      mine={
                        mine
                          ? (mine.get(event.id) ?? { predicted: false, joker: false })
                          : undefined
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
      </div>
      <InstallPrompt signedIn={mine !== null} hasPredicted={(mine?.size ?? 0) > 0} />
    </main>
  );
}
