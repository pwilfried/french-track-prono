import Link from "next/link";

import { messages } from "@/app/messages.fr";
import { ChipStatus } from "@/components/ui/chip-status";
import { cn } from "@/lib/utils";

const text = messages.leagues;

export type LeagueEventItem = {
  id: string;
  slug: string;
  /** « 100 m hommes ». */
  name: string;
  /** ISO 8601. */
  startsAt: string;
  counts: boolean;
};

/**
 * The finals of a league limited to families (#613). In the league, an event of another family is
 * greyed with « Hors ligue » and stays open to predictions; in the preview of « Ajouter une
 * famille », each event tells whether it would count (« Compte ») or not (« Ne compte pas »).
 */
export function LeagueEventList({
  events,
  variant = "league",
  title,
}: {
  events: LeagueEventItem[];
  variant?: "league" | "preview";
  title: string;
}) {
  const preview = variant === "preview";
  return (
    <section aria-labelledby={`league-events-${variant}`} className="flex flex-col gap-2">
      <h2
        id={`league-events-${variant}`}
        className="text-xs font-bold uppercase tracking-wider text-muted-foreground"
      >
        {title}
      </h2>
      {events.length === 0 ? (
        <p className="rounded-card bg-muted p-4 text-sm text-muted-foreground">
          {preview ? text.previewEmpty : text.eventsEmpty}
        </p>
      ) : (
        <>
          <ul className="flex flex-col gap-2">
            {events.map((e) => (
              <li key={e.id}>
                <Link
                  href={`/epreuves/${e.slug}`}
                  className={cn(
                    "flex min-h-13 items-center gap-3 rounded-2xl border border-border bg-card px-3.5 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    !e.counts && !preview && "bg-muted text-muted-foreground",
                  )}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block break-words font-semibold">{e.name}</span>
                    <span className="block text-xs text-muted-foreground">
                      {text.eventDay(e.startsAt)}
                    </span>
                  </span>
                  {preview ? (
                    <ChipStatus tone={e.counts ? "ok" : "neutral"}>
                      {e.counts ? text.previewCounts : text.previewNotCounted}
                    </ChipStatus>
                  ) : (
                    !e.counts && <ChipStatus tone="neutral">{text.outOfLeague}</ChipStatus>
                  )}
                </Link>
              </li>
            ))}
          </ul>
          <p className="text-sm text-muted-foreground">
            {preview ? text.previewNote : text.outOfLeagueNote}
          </p>
        </>
      )}
    </section>
  );
}
