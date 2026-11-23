import Link from "next/link";

import { messages } from "@/app/messages.fr";
import { cn } from "@/lib/utils";

export type ScopeChip = { id: string; label: string; href: string; selected: boolean };

/**
 * The scope of the ranking as a row of buttons that scrolls sideways, without scrollbar (#1131):
 * one chip per league or competition. Each chip is a link, so the view stays in the URL. `extra`
 * is a last link that is no scope (« ＋ Créer ou rejoindre »).
 */
export function ScopeChips({
  chips,
  extra,
}: {
  chips: ScopeChip[];
  extra?: { label: string; href: string };
}) {
  const base =
    "inline-flex min-h-11 shrink-0 items-center whitespace-nowrap rounded-full px-4 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
  return (
    <nav aria-label={messages.ranking.scopeLabel}>
      <ul className="-mx-4 flex gap-2 overflow-x-auto px-4 py-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {chips.map((chip) => (
          <li key={chip.id} className="flex">
            <Link
              href={chip.href}
              aria-current={chip.selected ? "page" : undefined}
              className={cn(
                base,
                chip.selected
                  ? "bg-foreground font-bold text-background"
                  : "border border-border bg-card font-semibold text-foreground",
              )}
            >
              {chip.label}
            </Link>
          </li>
        ))}
        {extra && (
          <li className="flex">
            <Link
              href={extra.href}
              className={cn(
                base,
                "border border-dashed border-border font-semibold text-foreground",
              )}
            >
              {extra.label}
            </Link>
          </li>
        )}
      </ul>
    </nav>
  );
}
