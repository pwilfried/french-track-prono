import Link from "next/link";

import { messages } from "@/app/messages.fr";
import type { EventGender } from "@/domain/event";
import { cn } from "@/lib/utils";

const options: { value: EventGender | null; label: string }[] = [
  { value: null, label: messages.events.filters.all },
  { value: "F", label: messages.events.filters.F },
  { value: "M", label: messages.events.filters.M },
  { value: "X", label: messages.events.filters.X },
];

/** The list filtered on a category, in the competition shown (none: the next one). */
const hrefOf = (gender: EventGender | null, competition?: string) => {
  const query = new URLSearchParams();
  if (competition) query.set("competition", competition);
  if (gender) query.set("genre", gender);
  return query.size ? `/epreuves?${query}` : "/epreuves";
};

/**
 * Filter by category: chips on phones, a side list with counts from md (Officiel boards 02).
 * Plain links, so the page stays a server component and the filter is shareable.
 */
export function GenderFilter({
  selected,
  counts,
  competition,
}: {
  selected: EventGender | null;
  counts?: Record<"all" | EventGender, number>;
  /** Kept in the links when the list shows a chosen competition. */
  competition?: string;
}) {
  return (
    <nav
      aria-label={messages.events.filtersLabel}
      className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0"
    >
      <p className="mb-2 hidden text-xs font-bold uppercase tracking-wide text-muted-foreground md:block">
        {messages.events.category}
      </p>
      <ul className="flex gap-2 md:flex-col md:gap-1">
        {options.map((option) => {
          const active = option.value === selected;
          const count = counts?.[option.value ?? "all"];
          return (
            <li key={option.label}>
              <Link
                href={hrefOf(option.value, competition)}
                aria-current={active ? "true" : undefined}
                className={cn(
                  "inline-flex min-h-11 items-center gap-3 rounded-full px-5 text-sm font-semibold md:flex md:w-full md:justify-between md:rounded-xl md:px-3",
                  active
                    ? "bg-brand text-brand-foreground dark:bg-secondary dark:text-secondary-foreground md:border md:border-brand md:bg-brand-soft md:text-brand-ink dark:md:border-secondary dark:md:bg-brand-soft dark:md:text-brand-ink"
                    : "border border-border bg-background text-foreground md:border-transparent md:bg-transparent",
                )}
              >
                {option.label}
                {count !== undefined && (
                  <span className="hidden font-mono text-xs tabular-nums text-muted-foreground md:inline">
                    {count}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
