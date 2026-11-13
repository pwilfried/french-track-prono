import Link from "next/link";

import { UseCaseError } from "@/application/errors";
import { listEvents } from "@/application/list-events";
import { listMyEventMarks } from "@/application/list-my-predictions";
import { getProgramAlert } from "@/application/program-alerts";
import { ErrorNotice } from "@/components/error-notice";
import { CompetitionSwitcher } from "@/components/events/competition-switcher";
import { DayBar } from "@/components/events/day-bar";
import { DayProgress } from "@/components/events/day-progress";
import { EventCard, type MyEventState } from "@/components/events/event-card";
import { EventFilters } from "@/components/events/event-filters";
import { ProgramPending } from "@/components/events/program-pending";
import { InstallPrompt } from "@/components/shell/install-prompt";
import { buttonVariants } from "@/components/ui/button";
import { daysUntil, nextCompetition } from "@/domain/competition";
import type { EventSummary } from "@/domain/event";
import { eventsProgress, filterCounts, filterEvents, type EventFilter } from "@/domain/event-list";
import { defaultDay, eventsBySession, eventsOfDay, programDays } from "@/domain/program";
import {
  createPublicSupabaseClient,
  createSupabaseEventReader,
  createSupabasePointsRepository,
  createSupabasePredictionRepository,
  createSupabaseProgramAlertRepository,
} from "@/infra";

import {
  currentCompetition,
  currentCompetitionDay,
  currentDay,
  loadCompetitions,
  loadMyLeagues,
  playerCompetitions,
  type ShownCompetition,
} from "../competition";
import { messages } from "../messages.fr";
import { paramText } from "../search-params";
import { getCurrentUser, getSessionClient } from "../session";
import { ProgramAlertButton } from "./program-alert-button";

const text = messages.competitions;
const filterList: EventFilter[] = ["todo", "posed", "done", "all"];

async function loadEvents(competition: ShownCompetition): Promise<EventSummary[] | "error"> {
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
async function loadMine(competition: ShownCompetition): Promise<Map<string, MyEventState> | null> {
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

/** Whether the signed-in player asked to be told when the programme is out (#659). */
async function loadAlert(competition: ShownCompetition): Promise<boolean> {
  try {
    return await getProgramAlert({
      alerts: createSupabaseProgramAlertRepository(await getSessionClient()),
    }).execute({ competitionSlug: competition.slug });
  } catch (error) {
    if (error instanceof UseCaseError) return false;
    throw error;
  }
}

/**
 * The « Compétitions » tab (#659): the competition shown as a card that opens the sheet to choose
 * another, its days, my progress on one line, the filters, then the events of the day by session.
 * Without a programme yet: when it starts and « Me prévenir à la publication ».
 */
export default async function CompetitionsPage({
  searchParams,
}: {
  searchParams: Promise<{
    competition?: string | string[];
    filtre?: string | string[];
    jour?: string | string[];
  }>;
}) {
  const search = await searchParams;
  // A competition chosen (?competition=), else the next one of my leagues (#352).
  const [choices, lists, leagues, user] = await Promise.all([
    playerCompetitions(),
    loadCompetitions(),
    loadMyLeagues(),
    getCurrentUser(),
  ]);
  const competition = await currentCompetition(paramText(search.competition) ?? choices.preferred);
  const [loaded, mine] = await Promise.all([loadEvents(competition), loadMine(competition)]);
  const events = loaded === "error" ? [] : loaded;
  const now = new Date();
  const today = currentCompetitionDay();
  const all = [...lists.coming, ...lists.past];

  const link = (params: { jour?: string | null; filtre?: EventFilter }) => {
    const query = new URLSearchParams({ competition: competition.slug });
    if (params.jour) query.set("jour", params.jour);
    if (params.filtre) query.set("filtre", params.filtre);
    return `/competitions?${query}`;
  };

  const head = (
    <header className="px-4 pb-1 pt-5">
      <div className="mx-auto max-w-md md:max-w-5xl">
        <CompetitionSwitcher
          key={competition.slug}
          shown={competition}
          competitions={all.length > 0 ? all : [competition]}
          myLeagueSlugs={leagues.flatMap((league) => league.competitionSlugs)}
          today={currentDay()}
        />
      </div>
    </header>
  );

  if (loaded !== "error" && events.length === 0) {
    const live = nextCompetition(
      all.filter((c) => c.slug !== competition.slug && c.finals > 0),
      currentDay(),
    );
    const here = link({});
    return (
      <main id="main" className="flex flex-1 flex-col">
        {head}
        <div className="mx-auto flex w-full max-w-md flex-col gap-5 px-4 py-5">
          <ProgramPending
            daysToStart={daysUntil(competition.startsOn, currentDay())}
            liveHref={live ? `/competitions?competition=${encodeURIComponent(live.slug)}` : null}
            alert={
              user ? (
                <ProgramAlertButton
                  competition={competition.slug}
                  on={await loadAlert(competition)}
                />
              ) : (
                <Link
                  href={`/connexion?next=${encodeURIComponent(here)}`}
                  className={buttonVariants()}
                >
                  {text.pending.signIn}
                </Link>
              )
            }
          />
        </div>
      </main>
    );
  }

  const days = programDays(competition, events, today);
  const day = defaultDay(days, today, paramText(search.jour));
  const dayEvents = day ? eventsOfDay(events, day) : [];
  const predicted = new Set(mine?.keys());
  const counts = filterCounts(dayEvents, predicted, now);
  // A visitor has nothing to do nor posed; « Terminées » shows once an event of the day has run.
  const filters = filterList.filter(
    (f) => (mine || (f !== "todo" && f !== "posed")) && (f !== "done" || counts.done > 0),
  );
  const chosen = filters.find((f) => f === paramText(search.filtre));
  const filter = chosen ?? (mine && counts.todo > 0 ? "todo" : "all");
  const sessions = eventsBySession(filterEvents(dayEvents, predicted, now, filter));
  const progress = mine ? eventsProgress(events, mine) : null;

  return (
    <main id="main" className="flex flex-1 flex-col">
      {head}
      <div className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 py-4 md:max-w-5xl">
        <DayBar days={days} selected={day} hrefOf={(d) => link({ jour: d })} />
        {progress && (
          <DayProgress
            todo={counts.todo}
            posed={progress.posed}
            total={progress.total}
            points={progress.points}
          />
        )}
        <EventFilters
          filters={filters}
          selected={filter}
          counts={counts}
          hrefOf={(f) => link({ jour: day, filtre: f })}
        />
        {loaded === "error" ? (
          <ErrorNotice retryHref="/competitions" />
        ) : sessions.length === 0 ? (
          <p className="rounded-card bg-muted p-4">
            {dayEvents.length === 0
              ? text.emptyDay
              : filter === "todo"
                ? messages.events.allPosed
                : messages.events.empty}
          </p>
        ) : (
          sessions.map(({ session, events: sessionEvents }) => {
            const id = `session-${session}`;
            return (
              <section key={id} aria-labelledby={id} className="flex flex-col gap-2">
                <h2
                  id={id}
                  className="flex justify-between gap-3 border-b border-border pb-1 text-xs font-bold uppercase tracking-wide text-muted-foreground"
                >
                  <span>{text.sessions[session]}</span>
                  <span className="font-mono tabular-nums">
                    {messages.start.events(sessionEvents.length)}
                  </span>
                </h2>
                <ul className="grid gap-2 md:grid-cols-2">
                  {sessionEvents.map((event) => (
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
