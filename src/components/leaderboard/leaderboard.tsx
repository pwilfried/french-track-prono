import Link from "next/link";

import { messages } from "@/app/messages.fr";
import { buttonVariants } from "@/components/ui/button";
import type { RankedPlayer } from "@/domain/ranking";
import { cn } from "@/lib/utils";

export type LeaderboardRow = RankedPlayer & { avatar?: string };

/** What decided a player's place, shown under the pseudo. */
function detailOf(row: LeaderboardRow, me: boolean): string {
  const parts: string[] = me ? [messages.leaderboard.me] : [];
  if (row.points === 0) parts.push(messages.leaderboard.noPoints);
  else if (row.perfectPodiums > 0) parts.push(messages.leaderboard.perfect(row.perfectPodiums));
  else if (row.winnersFound > 0) parts.push(messages.leaderboard.winners(row.winnersFound));
  return parts.join(" · ");
}

/**
 * A ranking (league or general): position, avatar, pseudo, points. Tied players share the position
 * and are marked "ex æquo"; the signed-in player's row is highlighted.
 */
export function Leaderboard({
  rows,
  meId,
  status = "ready",
  retryHref = "",
}: {
  rows: LeaderboardRow[];
  meId?: string;
  status?: "ready" | "loading" | "error";
  retryHref?: string;
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

  const tied = (index: number) =>
    rows[index - 1]?.rank === rows[index]!.rank || rows[index + 1]?.rank === rows[index]!.rank;

  return (
    <ol aria-label={messages.leaderboard.label} className="flex flex-col">
      {rows.map((row, index) => {
        const me = row.userId === meId;
        const detail = detailOf(row, me);
        return (
          <li
            key={row.userId}
            aria-current={me ? "true" : undefined}
            className={cn(
              "flex min-h-14 items-center gap-2.5 border-b border-border px-1 py-1.5",
              me && "rounded-2xl border-transparent bg-secondary/30",
            )}
          >
            <span className="w-9 shrink-0 text-center text-lg font-extrabold">
              <span className="sr-only">{messages.leaderboard.position(row.rank)}</span>
              <span aria-hidden>{row.rank}</span>
              {tied(index) && (
                <span className="block text-[10px] font-bold leading-none text-muted-foreground">
                  {messages.leaderboard.tie}
                </span>
              )}
            </span>
            <span
              aria-hidden
              className="grid size-9 shrink-0 place-items-center rounded-full bg-muted text-lg"
            >
              {row.avatar ?? "🏃"}
            </span>
            <span className="min-w-0 flex-1 font-bold [overflow-wrap:anywhere]">
              {row.pseudo}
              {detail && (
                <span className="block text-xs font-semibold text-muted-foreground">{detail}</span>
              )}
            </span>
            <span className="shrink-0 text-lg font-extrabold">
              <span aria-hidden>{row.points}</span>
              <span className="sr-only">{messages.leaderboard.points(row.points)}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
