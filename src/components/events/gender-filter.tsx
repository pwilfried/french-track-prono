import Link from "next/link";

import { messages } from "@/app/messages.fr";
import type { EventGender } from "@/domain/event";
import { cn } from "@/lib/utils";

const options: { value: EventGender | null; href: string; label: string }[] = [
  { value: null, href: "/epreuves", label: messages.events.filters.all },
  { value: "F", href: "/epreuves?genre=F", label: messages.events.filters.F },
  { value: "M", href: "/epreuves?genre=M", label: messages.events.filters.M },
  { value: "X", href: "/epreuves?genre=X", label: messages.events.filters.X },
];

/** Filter chips: plain links, so the page stays a server component and the filter is shareable. */
export function GenderFilter({ selected }: { selected: EventGender | null }) {
  return (
    <nav aria-label={messages.events.filtersLabel} className="-mx-4 overflow-x-auto px-4">
      <ul className="flex gap-2">
        {options.map((option) => {
          const active = option.value === selected;
          return (
            <li key={option.label}>
              <Link
                href={option.href}
                aria-current={active ? "true" : undefined}
                className={cn(
                  "inline-flex min-h-11 items-center rounded-full px-5 text-base font-semibold",
                  active ? "bg-primary text-primary-foreground" : "bg-muted text-foreground",
                )}
              >
                {option.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
