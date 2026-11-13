import Link from "next/link";

import { cn } from "@/lib/utils";

/**
 * A row of competition chips (plain links), scrolling sideways: « Tous mes pronos », the Manager
 * catalogue, the admin competition list.
 */
export function CompetitionChips({
  label,
  chips,
}: {
  label: string;
  chips: { key: string; href: string; name: string; active: boolean }[];
}) {
  return (
    <nav aria-label={label} className="-mx-4 overflow-x-auto px-4">
      <ul className="flex gap-2">
        {chips.map((chip) => (
          <li key={chip.key} className="shrink-0">
            <Link
              href={chip.href}
              aria-current={chip.active ? "page" : undefined}
              className={cn(
                "inline-flex min-h-11 items-center whitespace-nowrap rounded-full border-2 px-4 text-sm font-semibold",
                chip.active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card",
              )}
            >
              {chip.name}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
