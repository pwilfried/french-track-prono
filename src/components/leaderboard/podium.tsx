import { messages } from "@/app/messages.fr";
import { Bib } from "@/components/profile/bib";
import { cn } from "@/lib/utils";

import type { LeaderboardRow } from "./ranking-row";

/** Steps drawn 2-1-3 (#551): the order in the list stays 1-2-3 for screen readers. */
const STEPS = [
  {
    order: "order-2",
    height: "h-20",
    medal: "from-(--medal-gold-from) to-(--medal-gold-to) text-(--medal-gold-ink)",
  },
  {
    order: "order-1",
    height: "h-14",
    medal: "from-(--medal-silver-from) to-(--medal-silver-to) text-(--medal-silver-ink)",
  },
  {
    order: "order-3",
    height: "h-10",
    medal: "from-(--medal-bronze-from) to-(--medal-bronze-to) text-(--medal-bronze-ink)",
  },
] as const;

/**
 * The first three of a ranking on a podium (#551), steps 2-1-3, with their bibs, pseudos and
 * points; the player's own place is outlined. Nothing while nobody has points.
 */
export function Podium({
  rows,
  meId,
  status = "ready",
}: {
  rows: LeaderboardRow[];
  meId?: string;
  status?: "ready" | "loading";
}) {
  if (status === "loading") {
    return (
      <div
        role="status"
        aria-label={messages.leaderboard.loading}
        className="grid grid-cols-3 items-end gap-2"
      >
        {["h-28", "h-36", "h-24"].map((h) => (
          <div
            key={h}
            className={cn(h, "animate-pulse rounded-2xl bg-muted motion-reduce:animate-none")}
          />
        ))}
      </div>
    );
  }
  const top = rows.slice(0, 3).filter((row) => row.points > 0);
  if (top.length === 0) return null;

  return (
    <ol aria-label={messages.leaderboard.podium} className="grid grid-cols-3 items-end gap-2">
      {top.map((row, index) => {
        const step = STEPS[index]!;
        const me = row.userId === meId;
        return (
          <li
            key={row.userId}
            aria-current={me ? "true" : undefined}
            aria-label={messages.leaderboard.podiumPlace(row.rank, row.pseudo, row.points)}
            className={cn("flex min-w-0 flex-col items-center gap-1", step.order)}
          >
            <Bib bib={row.bib} className="h-9 min-w-11 text-base" />
            <span
              className={cn(
                "w-full text-center text-sm font-bold leading-tight [overflow-wrap:anywhere]",
                me && "rounded-md bg-brand-soft px-1 text-brand-ink",
              )}
            >
              {row.pseudo}
            </span>
            <span className="font-mono text-sm font-bold tabular-nums">
              {messages.format.pts(row.points)}
            </span>
            <span
              aria-hidden
              className={cn(
                "grid w-full place-items-center rounded-t-2xl bg-gradient-to-b font-display text-2xl font-extrabold",
                step.height,
                step.medal,
                me && "ring-2 ring-brand ring-offset-2 ring-offset-background dark:ring-secondary",
              )}
            >
              {row.rank}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
