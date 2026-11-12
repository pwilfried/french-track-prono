import Link from "next/link";

import { messages } from "@/app/messages.fr";
import { buttonVariants } from "@/components/ui/button";
import { aroundMe } from "@/domain/ranking";

import { RankingRow, type LeaderboardRow } from "./ranking-row";

export type { LeaderboardRow } from "./ranking-row";

/**
 * A ranking (league or general): position, bib, pseudo, move, points. Tied players share the
 * position and are marked "ex æquo"; the signed-in player's row is highlighted. `aroundMe` cuts a
 * long ranking to the first ten, « ··· », then the player and two neighbours on each side (#551).
 */
export function Leaderboard({
  rows,
  meId,
  status = "ready",
  retryHref = "",
  aroundMe: cut = false,
}: {
  rows: LeaderboardRow[];
  meId?: string;
  status?: "ready" | "loading" | "error";
  retryHref?: string;
  aroundMe?: boolean;
}) {
  if (status === "error") {
    return (
      <div role="alert" className="flex flex-col items-start gap-3 rounded-card bg-muted p-4">
        <p>{messages.leaderboard.error}</p>
        <Link href={retryHref} className={buttonVariants({ variant: "outline" })}>
          {messages.errors.retry}
        </Link>
      </div>
    );
  }
  if (status === "loading") {
    return (
      <div role="status" aria-label={messages.leaderboard.loading} className="flex flex-col gap-2">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-14 animate-pulse rounded-2xl bg-muted motion-reduce:animate-none"
          />
        ))}
      </div>
    );
  }
  if (rows.length === 0) {
    return (
      <p className="rounded-card bg-muted p-4 text-muted-foreground">
        {messages.leaderboard.empty}
      </p>
    );
  }

  const sharing = new Map<number, number>();
  for (const row of rows) sharing.set(row.rank, (sharing.get(row.rank) ?? 0) + 1);
  const items = cut ? aroundMe(rows, meId) : rows;

  return (
    <ol
      aria-label={messages.leaderboard.label}
      className="flex flex-col gap-0.5 rounded-card border border-border bg-card p-2"
    >
      {items.map((row, index) =>
        row === "gap" ? (
          <li
            key={`gap-${index}`}
            aria-hidden
            className="py-1 text-center font-mono font-bold tracking-widest text-muted-foreground"
          >
            ···
          </li>
        ) : (
          <RankingRow
            key={row.userId}
            row={row}
            me={row.userId === meId}
            tied={(sharing.get(row.rank) ?? 0) > 1}
            total={rows.length}
          />
        ),
      )}
    </ol>
  );
}
