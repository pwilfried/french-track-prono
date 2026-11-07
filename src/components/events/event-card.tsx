import Link from "next/link";

import { CountdownBadge } from "@/components/countdown/countdown-badge";
import { eventPhase } from "@/domain/countdown";
import type { EventSummary } from "@/domain/event";
import { cn } from "@/lib/utils";
import { messages } from "@/app/messages.fr";

const statusStyle = {
  upcoming: "bg-muted text-foreground",
  live: "bg-primary text-primary-foreground",
  finished: "bg-success-text text-white dark:bg-success dark:text-nuit",
} as const;

/** What the signed-in player did on this event; absent for a visitor. */
export type MyEventState = { predicted: boolean; joker: boolean };

export function EventCard({
  event,
  timeZone,
  mine,
  now = new Date(),
}: {
  event: EventSummary;
  timeZone: string;
  mine?: MyEventState;
  now?: Date;
}) {
  const open = eventPhase(now, event.lockAt) === "open";
  const time = new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  }).format(new Date(event.startsAt));

  return (
    <li>
      <Link
        href={`/epreuves/${event.slug}`}
        className="flex min-h-11 items-center gap-3 rounded-card border border-border bg-card p-3 text-card-foreground"
      >
        <span
          aria-hidden="true"
          className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-extrabold"
        >
          {messages.events.genderInitial[event.gender]}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-display text-lg font-bold leading-tight">{event.discipline}</p>
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
            <span>
              {messages.events.gender[event.gender]} · {time}
            </span>
            {event.isFeatured && (
              <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-bold text-secondary-foreground">
                ★ {messages.events.featured}
              </span>
            )}
          </p>
          {mine && (mine.predicted || open) && (
            <p className="mt-1 flex flex-wrap gap-1.5">
              <span
                className={cn(
                  "rounded-full px-2.5 py-0.5 text-xs font-extrabold",
                  mine.predicted ? "bg-success/20 text-success-text" : "bg-muted text-foreground",
                )}
              >
                {mine.predicted
                  ? messages.myPredictions.predicted
                  : messages.myPredictions.toPredict}
              </span>
              {mine.joker && (
                <span className="rounded-full bg-secondary/40 px-2.5 py-0.5 text-xs font-extrabold text-foreground">
                  {messages.myPredictions.joker}
                </span>
              )}
            </p>
          )}
        </div>
        {event.status === "upcoming" ? (
          <span className="shrink-0">
            <CountdownBadge lockAt={event.lockAt} compact />
          </span>
        ) : (
          <span
            className={cn(
              "shrink-0 rounded-full px-3 py-1 text-xs font-bold",
              statusStyle[event.status],
            )}
          >
            {messages.events.status[event.status]}
          </span>
        )}
      </Link>
    </li>
  );
}
