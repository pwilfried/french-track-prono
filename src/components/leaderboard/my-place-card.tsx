import { messages } from "@/app/messages.fr";
import type { Place } from "@/domain/ranking";

import { Change } from "./ranking-row";

const text = messages.ranking.place;

/**
 * « Ta place » (#661), at the head of the ranking: rank, points, move since the last finished
 * competition, the gap with the player just ahead and, in « Général », the top percent. The page
 * hides it for a visitor or a player not ranked.
 */
export function MyPlaceCard({
  place,
  showTop = false,
  status = "ready",
}: {
  place: Place;
  showTop?: boolean;
  status?: "ready" | "loading" | "error";
}) {
  if (status === "loading") {
    return (
      <div
        role="status"
        aria-label={text.loading}
        className="h-[104px] animate-pulse rounded-card bg-muted motion-reduce:animate-none"
      />
    );
  }
  if (status === "error") {
    return (
      <p role="alert" className="rounded-card bg-muted p-4 text-sm text-muted-foreground">
        {text.error}
      </p>
    );
  }
  return (
    <section
      aria-label={text.title}
      className="flex flex-col gap-2 rounded-card bg-brand p-4 text-brand-foreground"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-xs font-bold uppercase tracking-wide opacity-80">{text.title}</h2>
        {showTop && (
          <span className="rounded-full bg-background/15 px-2.5 py-0.5 text-sm font-bold">
            {text.top(place.topPercent)}
          </span>
        )}
      </div>
      <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="font-display text-4xl font-extrabold leading-none">
          {text.rank(place.rank)}
        </span>
        <span className="font-mono text-xl font-bold tabular-nums">
          {text.points(place.points)}
        </span>
        {place.change !== null && (
          <span className="inline-flex items-center gap-1 rounded-full bg-background px-2 py-0.5 text-sm">
            <Change change={place.change} className="w-auto" />
            <span className="text-xs font-semibold text-muted-foreground">{text.since}</span>
          </span>
        )}
      </p>
      <p className="text-sm font-semibold [overflow-wrap:anywhere]">
        {place.ahead
          ? text.ahead(place.ahead.gap, place.ahead.pseudo, place.ahead.rank)
          : text.first}
      </p>
    </section>
  );
}
