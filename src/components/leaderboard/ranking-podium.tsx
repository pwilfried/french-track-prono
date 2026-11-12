import { messages } from "@/app/messages.fr";
import { Bib } from "@/components/profile/bib";
import { cn } from "@/lib/utils";

import type { LeaderboardRow } from "./leaderboard";

/** The steps 2-1-3 (#551): heights and medal colours of the first, second and third rows. */
const STEPS = [
  {
    place: "order-2",
    step: "h-24 from-(--medal-gold-from) to-(--medal-gold-to) text-(--medal-gold-ink)",
  },
  {
    place: "order-1",
    step: "h-16 from-(--medal-silver-from) to-(--medal-silver-to) text-(--medal-silver-ink)",
  },
  {
    place: "order-3",
    step: "h-12 from-(--medal-bronze-from) to-(--medal-bronze-to) text-(--medal-bronze-ink)",
  },
];

/**
 * The first three of a ranking on the steps 2-1-3, with their bibs (#551). Read in rank order;
 * nothing until someone has points.
 */
export function RankingPodium({ rows, meId }: { rows: LeaderboardRow[]; meId?: string }) {
  const top = rows.filter((r) => r.points > 0).slice(0, 3);
  if (top.length === 0) return null;
  return (
    <ol aria-label={messages.ranking.podium} className="flex items-end justify-center gap-2 pt-2">
      {top.map((row, i) => (
        <li
          key={row.userId}
          aria-current={row.userId === meId ? "true" : undefined}
          className={cn(
            "flex min-w-0 flex-1 flex-col items-center gap-1 text-center",
            STEPS[i]!.place,
          )}
        >
          <Bib bib={row.bib} />
          <span className="max-w-full font-bold leading-tight [overflow-wrap:anywhere]">
            {row.pseudo}
          </span>
          {row.userId === meId && (
            <span className="text-xs font-semibold text-muted-foreground">
              {messages.leaderboard.me}
            </span>
          )}
          <span className="font-mono text-sm font-bold tabular-nums">
            {messages.ranking.points(row.points)}
          </span>
          <div
            className={cn(
              "flex w-full items-start justify-center rounded-t-2xl bg-gradient-to-b pt-2 font-display text-2xl font-extrabold",
              STEPS[i]!.step,
            )}
          >
            <span aria-hidden>{row.rank}</span>
            <span className="sr-only">{messages.leaderboard.position(row.rank)}</span>
          </div>
        </li>
      ))}
    </ol>
  );
}
