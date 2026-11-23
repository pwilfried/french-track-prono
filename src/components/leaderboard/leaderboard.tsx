import Link from "next/link";

import { messages } from "@/app/messages.fr";
import { buttonVariants } from "@/components/ui/button";
import { aroundMe } from "@/domain/ranking";

import { RankingRow, type LeaderboardRow } from "./ranking-row";

export type { LeaderboardRow } from "./ranking-row";

/**
 * A ranking (league or general): position, bib, pseudo, move, points. Tied players share the
 * position and are marked "ex æquo"; the signed-in player's row is highlighted. `aroundMe` cuts a
 * long ranking to the first ten, « · · · N joueurs · · · », then the player and two neighbours on each side (#551).
 */
export function Leaderboard({
  rows,
  meId,
  status = "ready",
  retryHref = "",
  aroundMe: cut = false,
  skip = 0,
  lantern = false,
}: {
  rows: LeaderboardRow[];
  meId?: string;
  status?: "ready" | "loading" | "error";
  retryHref?: string;
  aroundMe?: boolean;
  /** Rows already shown on the podium: the list starts after them (#1131). */
  skip?: number;
  /** Mark the last row « Lanterne rouge » (a league). */
  lantern?: boolean;
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
  const listed = rows.slice(skip);
  const items = cut ? aroundMe(listed, meId) : listed;
  const last = rows.length > 1 ? rows.at(-1) : undefined;

  if (listed.length === 0) return null;

  // « · · · 36 players · · · »: the rows the cut left out between two shown ones.
  const hiddenAt = (index: number) => {
    const before = items[index - 1];
    const after = items[index + 1];
    if (!before || !after || before === "gap" || after === "gap") return 0;
    return listed.indexOf(after) - listed.indexOf(before) - 1;
  };

  return (
    <ol
      aria-label={messages.leaderboard.label}
      className="flex flex-col gap-0.5 rounded-card border border-border bg-card p-2"
    >
      {/* The header of the points column: the rows show bare figures under it (#706). */}
      <li
        aria-hidden
        className="flex justify-end px-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground"
      >
        {messages.leaderboard.pointsColumn}
      </li>
      {items.map((row, index) =>
        row === "gap" ? (
          <li
            key={`gap-${index}`}
            aria-hidden
            className="py-1 text-center text-xs font-bold text-muted-foreground"
          >
            {messages.ranking.gap(hiddenAt(index))}
          </li>
        ) : (
          <RankingRow
            key={row.userId}
            row={row}
            me={row.userId === meId}
            tied={(sharing.get(row.rank) ?? 0) > 1}
            total={rows.length}
            lantern={lantern && row === last}
          />
        ),
      )}
    </ol>
  );
}
