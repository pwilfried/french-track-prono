import Link from "next/link";

import { cn } from "@/lib/utils";

/**
 * The views of the rankings tab as pills in a rail (#1131): the selected one is filled, the others
 * transparent. Each view is a link (it lives in the URL). The panel it controls carries
 * `id={panelId}` and `aria-labelledby={`${idPrefix}-${selected}`}` (see `tabPanelProps`). A single
 * view is no choice: nothing shows.
 */
export function RankingTabs({
  label,
  tabs,
  selected,
  idPrefix,
  panelId,
}: {
  label: string;
  tabs: readonly { id: string; label: string; href: string }[];
  selected: string;
  idPrefix: string;
  panelId: string;
}) {
  if (tabs.length < 2) return null;
  return (
    <div role="tablist" aria-label={label} className="flex gap-1 rounded-full bg-muted p-1">
      {tabs.map((t) => (
        <Link
          key={t.id}
          href={t.href}
          role="tab"
          aria-selected={t.id === selected}
          aria-controls={panelId}
          id={`${idPrefix}-${t.id}`}
          className={cn(
            "inline-flex min-h-11 min-w-0 flex-1 items-center justify-center rounded-full px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            t.id === selected
              ? "bg-foreground font-bold text-background"
              : "bg-transparent font-medium text-muted-foreground",
          )}
        >
          <span className="truncate">{t.label}</span>
        </Link>
      ))}
    </div>
  );
}
