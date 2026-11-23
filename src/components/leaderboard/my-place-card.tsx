import { messages } from "@/app/messages.fr";
import type { Place } from "@/domain/ranking";

const text = messages.ranking.place;

/** The move since the last finished competition, as a tile; none when there is no earlier ranking. */
function moveOf(change: number | null): { label: string; style: string } | null {
  if (change === null) return null;
  if (change > 0) return { label: text.up(change), style: "bg-success-soft text-success-ink" };
  if (change < 0) return { label: text.down(-change), style: "bg-accent-text text-background" };
  return { label: text.same, style: "bg-background/15" };
}

/**
 * « Ta place » (#661, #1131), the one card at the head of the ranking: rank, medal and points, then
 * two tiles: the move since the last finished competition, and the gap with the player just ahead
 * (or the lead when first). The page hides it for a visitor or a player not ranked.
 */
export function MyPlaceCard({
  place,
  status = "ready",
}: {
  place: Place;
  status?: "ready" | "loading" | "error";
}) {
  if (status === "loading") {
    return (
      <div
        role="status"
        aria-label={text.loading}
        className="h-[148px] animate-pulse rounded-card bg-muted motion-reduce:animate-none"
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
  const move = moveOf(place.change);
  const gap = place.ahead
    ? text.gap(place.ahead.gap, place.ahead.rank)
    : text.lead(place.lead ?? 0);
  return (
    <section
      aria-label={text.title}
      className="flex flex-col gap-3 rounded-card bg-foreground p-4 text-background"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xs font-bold uppercase tracking-wide opacity-80">{text.title}</h2>
          <p className="font-display text-6xl font-extrabold leading-none">
            {text.rank(place.rank)}
          </p>
        </div>
        <p className="flex shrink-0 flex-col items-end gap-1">
          <span aria-hidden className="text-4xl leading-none">
            {text.medal(place.rank)}
          </span>
          <span className="font-mono text-xl font-bold tabular-nums">
            {text.points(place.points)}
          </span>
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {move && (
          <p
            className={`min-h-11 min-w-0 flex-1 basis-32 rounded-xl px-3 py-2 text-sm font-bold ${move.style}`}
          >
            {move.label}
          </p>
        )}
        <p className="min-h-11 min-w-0 flex-1 basis-32 rounded-xl bg-background/15 px-3 py-2 text-sm font-bold [overflow-wrap:anywhere]">
          {gap}
        </p>
      </div>
    </section>
  );
}
