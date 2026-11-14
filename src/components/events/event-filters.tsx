import Link from "next/link";

import { messages } from "@/app/messages.fr";
import type { EventFilter } from "@/domain/event-list";
import { segmentSurface, segmentedTrack } from "@/components/ui/view-tabs";
import { cn } from "@/lib/utils";

/**
 * The filters of the « Compétitions » tab as a segmented control with their count (#546, #659).
 * Plain links (`hrefOf`), so the page stays a server component and a filter can be shared.
 */
export function EventFilters({
  filters,
  selected,
  counts,
  hrefOf,
}: {
  filters: EventFilter[];
  selected: EventFilter;
  counts: Record<EventFilter, number>;
  hrefOf: (filter: EventFilter) => string;
}) {
  return (
    <nav aria-label={messages.events.filtersLabel}>
      <ul
        className={segmentedTrack}
        style={{ gridTemplateColumns: `repeat(${filters.length}, minmax(0, 1fr))` }}
      >
        {filters.map((filter) => {
          const active = filter === selected;
          return (
            <li key={filter}>
              <Link
                href={hrefOf(filter)}
                aria-current={active ? "true" : undefined}
                className={cn(
                  "flex min-h-11 items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-1 text-[13px] font-semibold",
                  segmentSurface(active),
                )}
              >
                {messages.events.filters[filter]}
                <span className="font-mono text-xs tabular-nums">{counts[filter]}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
