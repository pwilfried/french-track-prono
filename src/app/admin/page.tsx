import Link from "next/link";

import { UseCaseError } from "@/application/errors";
import { listEvents } from "@/application/list-events";
import { ErrorNotice } from "@/components/error-notice";
import { eventPhase } from "@/domain/countdown";
import type { EventSummary } from "@/domain/event";
import { cn } from "@/lib/utils";
import {
  createPublicSupabaseClient,
  createSupabaseEventReader,
  createSupabasePointsRepository,
} from "@/infra";

import { COMPETITION_SLUG, COMPETITION_TEXT, COMPETITION_TIME_ZONE } from "../competition";
import { messages } from "../messages.fr";
import { adminOnly } from "./guard";

type State = "todo" | "entered" | "scored";
const STATES: State[] = ["todo", "entered", "scored"];
const tagStyle: Record<State, string> = {
  todo: "bg-muted text-foreground",
  entered: "bg-secondary/40 text-foreground",
  scored: "bg-success/20 text-success-text",
};

async function load(client: Awaited<ReturnType<typeof adminOnly>>["client"]) {
  try {
    const [events, progress] = await Promise.all([
      listEvents({ events: createSupabaseEventReader(createPublicSupabaseClient()) }).execute({
        competitionSlug: COMPETITION_SLUG,
      }),
      createSupabasePointsRepository(client).progress(COMPETITION_SLUG),
    ]);
    return { events, progress };
  } catch (error) {
    if (error instanceof UseCaseError) return "error" as const;
    throw error;
  }
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ etat?: string }>;
}) {
  const { client } = await adminOnly();
  const loaded = await load(client);
  const { etat } = await searchParams;
  const wanted = STATES.find((s) => s === etat) ?? "todo";

  const now = new Date();
  const stateOf = (event: EventSummary): State =>
    loaded !== "error" && loaded.progress.scored.includes(event.id)
      ? "scored"
      : loaded !== "error" && loaded.progress.withResult.includes(event.id)
        ? "entered"
        : "todo";
  const locked =
    loaded === "error" ? [] : loaded.events.filter((e) => eventPhase(now, e.lockAt) === "locked");
  const count = (state: State) => locked.filter((e) => stateOf(e) === state).length;
  const shown = locked.filter((e) => stateOf(e) === wanted);
  const time = new Intl.DateTimeFormat("fr-FR", {
    weekday: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: COMPETITION_TIME_ZONE,
  });

  return (
    <main id="main" className="flex flex-1 flex-col">
      <header className="hero px-4 pb-6 pt-8">
        <div className="mx-auto max-w-md">
          <h1 className="flex items-center gap-3 font-display text-3xl font-extrabold uppercase leading-none">
            {messages.admin.title}
            <span className="rounded-full bg-secondary px-3 py-1 font-sans text-sm font-extrabold text-secondary-foreground">
              {messages.admin.badge}
            </span>
          </h1>
          <p className="mt-2 text-[#dce6f5]">
            {messages.admin.subtitle(COMPETITION_TEXT.name, locked.length)}
          </p>
        </div>
      </header>
      <div className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 py-5">
        {loaded === "error" ? (
          <ErrorNotice retryHref="/admin" message={messages.errors.POINTS_UNAVAILABLE} />
        ) : (
          <>
            <nav
              aria-label={messages.admin.filters}
              className="-mx-4 flex gap-2 overflow-x-auto px-4"
            >
              {STATES.map((state) => (
                <Link
                  key={state}
                  href={`/admin?etat=${state}`}
                  aria-current={state === wanted ? "page" : undefined}
                  className={cn(
                    "inline-flex min-h-11 items-center whitespace-nowrap rounded-full px-4 font-semibold",
                    state === wanted
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-foreground",
                  )}
                >
                  {messages.admin.filter[state](count(state))}
                </Link>
              ))}
            </nav>
            {shown.length === 0 ? (
              <p className="rounded-card bg-muted p-4">{messages.admin.empty}</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {shown.map((event) => (
                  <li key={event.id}>
                    <Link
                      href={`/admin/${event.slug}`}
                      className="flex min-h-16 items-center gap-3 rounded-card border border-border bg-card p-3.5"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block break-words font-bold">
                          {event.discipline} {messages.events.gender[event.gender].toLowerCase()}
                        </span>
                        <span className="block text-sm text-muted-foreground first-letter:uppercase">
                          {time.format(new Date(event.startsAt))}
                        </span>
                      </span>
                      <span
                        className={cn(
                          "shrink-0 rounded-full px-2.5 py-0.5 text-xs font-extrabold",
                          tagStyle[stateOf(event)],
                        )}
                      >
                        {messages.admin.state[stateOf(event)]}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <p className="rounded-card bg-muted p-4 text-sm text-muted-foreground">
              {messages.admin.lockedOnly}
            </p>
          </>
        )}
      </div>
    </main>
  );
}
