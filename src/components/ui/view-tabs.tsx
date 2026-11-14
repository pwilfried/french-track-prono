import Link from "next/link";

import { cn } from "@/lib/utils";

/**
 * The segmented view switch (#551, #708): « Ma ligue / Ce soir / Général » on the rankings tab,
 * « Mes ligues / Découvrir » on the leagues tab. Each view is a link (it lives in the URL); the
 * selected one is raised, bold and outlined, so it reads without colour. The panel it controls
 * carries `id={panelId}` and `aria-labelledby={`${idPrefix}-${selected}`}`.
 */
export function ViewTabs({
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
  return (
    <div
      role="tablist"
      aria-label={label}
      className="grid gap-1 rounded-full bg-muted p-1"
      style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
    >
      {tabs.map((t) => (
        <Link
          key={t.id}
          href={t.href}
          role="tab"
          aria-selected={t.id === selected}
          aria-controls={panelId}
          id={`${idPrefix}-${t.id}`}
          className={cn(
            "inline-flex min-h-11 min-w-0 items-center justify-center rounded-full px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            t.id === selected
              ? "bg-card font-bold text-foreground shadow-sm ring-1 ring-border"
              : "font-medium text-muted-foreground",
          )}
        >
          <span className="truncate">{t.label}</span>
        </Link>
      ))}
    </div>
  );
}
