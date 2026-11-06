import Link from "next/link";

import type { EventSummary } from "@/domain/event";
import { cn } from "@/lib/utils";
import { messages } from "@/app/messages.fr";

const statusStyle = {
  upcoming: "bg-muted text-foreground",
  live: "bg-primary text-primary-foreground",
  finished: "bg-success-text text-white dark:bg-success dark:text-nuit",
} as const;

export function EventCard({ event, timeZone }: { event: EventSummary; timeZone: string }) {
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
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full px-3 py-1 text-xs font-bold",
            statusStyle[event.status],
          )}
        >
          {messages.events.status[event.status]}
        </span>
      </Link>
    </li>
  );
}
