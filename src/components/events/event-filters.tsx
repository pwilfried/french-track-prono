import Link from "next/link";

import { messages } from "@/app/messages.fr";
import type { EventFilter } from "@/domain/event-list";
import { cn } from "@/lib/utils";

/**
 * The filters of the events tab as pills with their count (#546). Plain links, so the page stays
 * a server component and a filter can be shared.
 */
export function EventFilters({
  filters,
  selected,
  counts,
  competition,
}: {
  filters: EventFilter[];
  selected: EventFilter;
  counts: Record<EventFilter, number>;
  /** Kept in the links when the list shows a chosen competition. */
  competition?: string;
}) {
  return (
    <nav
      aria-label={messages.events.filtersLabel}
      className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none]"
    >
      <ul className="flex gap-2">
        {filters.map((filter) => {
          const active = filter === selected;
          const query = new URLSearchParams(competition ? { competition } : {});
          query.set("filtre", filter);
          return (
            <li key={filter}>
              <Link
                href={`/epreuves?${query}`}
                aria-current={active ? "true" : undefined}
                className={cn(
                  "inline-flex min-h-11 items-center gap-2 whitespace-nowrap rounded-full px-4 text-sm font-semibold",
                  active
                    ? "bg-brand text-brand-foreground dark:bg-secondary dark:text-secondary-foreground"
                    : "border border-border bg-background text-foreground",
                )}
              >
                {messages.events.filters[filter]}
                <span
                  className={cn(
                    "font-mono text-xs tabular-nums",
                    !active && "text-muted-foreground",
                  )}
                >
                  {counts[filter]}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
