import { listEvents } from "@/application/list-events";
import { listMyEventMarks } from "@/application/list-my-predictions";
import { UseCaseError } from "@/application/errors";
import { ErrorNotice } from "@/components/error-notice";
import { CompetitionPicker } from "@/components/events/competition-picker";
import { EventCard, type MyEventState } from "@/components/events/event-card";
import { EventFilters } from "@/components/events/event-filters";
import { ProgressCard } from "@/components/events/progress-card";
import { InstallPrompt } from "@/components/shell/install-prompt";
import { TIME_ZONE } from "@/domain/competition";
import type { EventSummary } from "@/domain/event";
import {
  eventSections,
  eventsProgress,
  filterCounts,
  filterEvents,
  type EventFilter,
  type EventSection,
} from "@/domain/event-list";
import {
  createPublicSupabaseClient,
  createSupabaseEventReader,
  createSupabasePointsRepository,
  createSupabasePredictionRepository,
} from "@/infra";

import { currentCompetition, playerCompetitions } from "../competition";
import { messages } from "../messages.fr";
import { paramText } from "../search-params";
import { getCurrentUser, getSessionClient } from "../session";

const filterList: EventFilter[] = ["todo", "posed", "done", "all"];

const dayLabel = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: TIME_ZONE,
});

function sectionTitle(section: EventSection): string {
  if (section.kind === "done") return messages.events.done;
  const day = dayLabel.format(new Date(`${section.day}T12:00:00Z`));
  if (section.kind === "tonight") return messages.events.tonight(day);
  if (section.kind === "tomorrow") return messages.events.tomorrow(day);
  return day;
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
 * The signed-in player's predictions by event id, with the points won; null for a visitor, or when
 * they cannot be read (the list still shows, without the marks).
 */
async function loadMine(slug?: string): Promise<Map<string, MyEventState> | null> {
  const competition = await currentCompetition(slug);
  const user = await getCurrentUser();
  if (!user) return null;
  try {
    const client = await getSessionClient();
    const marks = await listMyEventMarks({
      predictions: createSupabasePredictionRepository(client),
      points: createSupabasePointsRepository(client),
    }).execute({ userId: user.userId, competitionSlug: competition.slug });
    return new Map<string, MyEventState>(
      marks.map((m) => [
        m.eventId,
        { predicted: true, joker: m.joker, points: m.points, hits: m.hits },
      ]),
    );
  } catch (error) {
    if (error instanceof UseCaseError) return null;
    throw error;
  }
}

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<{ filtre?: string | string[]; competition?: string }>;
}) {
  const search = await searchParams;
  // A competition chosen (?competition=), else the next one of my leagues (#352).
  const choices = await playerCompetitions();
  const asked = paramText(search.competition) ?? choices.preferred;
  const competition = await currentCompetition(asked);
  const [loaded, mine] = await Promise.all([loadEvents(asked), loadMine(asked)]);
  const events = loaded === "error" ? [] : loaded;
  const now = new Date();
  const predicted = new Set(mine?.keys());
  const counts = filterCounts(events, predicted, now);
  // A visitor has nothing to do nor posed; « Terminées » shows once an event has run (#546).
  const filters = filterList.filter(
    (f) => (mine || (f !== "todo" && f !== "posed")) && (f !== "done" || counts.done > 0),
  );
  const chosen = filters.find((f) => f === search.filtre);
  const filter = chosen ?? (mine ? "todo" : "all");
  const sections = eventSections(filterEvents(events, predicted, now, filter), now);

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

      <div className="mx-auto flex w-full max-w-md flex-col gap-5 px-4 py-5 md:max-w-5xl">
        {mine && loaded !== "error" && events.length > 0 && (
          <ProgressCard progress={eventsProgress(events, mine, now)} />
        )}
        <EventFilters filters={filters} selected={filter} counts={counts} competition={asked} />
        {loaded === "error" ? (
          <ErrorNotice retryHref="/epreuves" />
        ) : sections.length === 0 ? (
          <p className="rounded-card bg-muted p-4">
            {filter === "todo" ? messages.events.allPosed : messages.events.empty}
          </p>
        ) : (
          sections.map((section) => {
            const id = `section-${section.day ?? section.kind}`;
            return (
              <section key={id} aria-labelledby={id} className="flex flex-col gap-2">
                <h2
                  id={id}
                  className="flex justify-between gap-3 border-b border-border pb-1 text-xs font-bold uppercase tracking-wide text-muted-foreground"
                >
                  <span>{sectionTitle(section)}</span>
                  <span className="font-mono tabular-nums">{section.events.length}</span>
                </h2>
                <ul className="grid gap-2 md:grid-cols-2">
                  {section.events.map((event) => (
                    <EventCard
                      key={event.id}
                      event={event}
                      now={now}
                      mine={
                        mine
                          ? (mine.get(event.id) ?? { predicted: false, joker: false })
                          : undefined
                      }
                    />
                  ))}
                </ul>
              </section>
            );
          })
        )}
      </div>
      <InstallPrompt signedIn={mine !== null} hasPredicted={(mine?.size ?? 0) > 0} />
    </main>
  );
}
