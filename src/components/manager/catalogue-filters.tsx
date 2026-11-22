import Link from "next/link";

import { cn } from "@/lib/utils";

export type FilterChip = { key: string; name: string; href: string; active: boolean };

function Chips({ label, chips }: { label: string; chips: FilterChip[] }) {
  return (
    <nav aria-label={label}>
      <ul className="flex gap-2 overflow-x-auto pb-1">
        {chips.map((chip) => (
          <li key={chip.key}>
            <Link
              href={chip.href}
              prefetch={false}
              aria-current={chip.active ? "page" : undefined}
              className={cn(
                "inline-flex min-h-11 items-center whitespace-nowrap rounded-full border-2 px-3 text-sm font-semibold",
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

/**
 * The filters of the mercato catalogue (#1087): sort, family, discipline (once a family is
 * chosen), sex, then the toggles, as chips in one scrollable row each, so the first athlete stays in view on a phone. Plain links, so they work
 * without script.
 */
export function CatalogueFilters({
  sort,
  families,
  disciplines,
  sexes,
  toggles,
  clear,
}: {
  sort: { label: string; options: FilterChip[] };
  families: { label: string; chips: FilterChip[] };
  /** Empty until a family is chosen. */
  disciplines: { label: string; chips: FilterChip[] };
  sexes: { label: string; chips: FilterChip[] };
  toggles: { label: string; chips: FilterChip[] };
  /** Shown while a filter is active. */
  clear: { name: string; href: string } | null;
}) {
  return (
    <div className="flex flex-col gap-3">
      <Chips label={sort.label} chips={sort.options} />
      <Chips label={families.label} chips={families.chips} />
      {disciplines.chips.length > 0 && (
        <Chips label={disciplines.label} chips={disciplines.chips} />
      )}
      <div className="flex gap-4 overflow-x-auto">
        <Chips label={sexes.label} chips={sexes.chips} />
        <Chips label={toggles.label} chips={toggles.chips} />
      </div>
      {clear && (
        <Link
          href={clear.href}
          prefetch={false}
          className="inline-flex min-h-11 items-center self-start text-sm font-bold underline underline-offset-4"
        >
          {clear.name}
        </Link>
      )}
    </div>
  );
}
