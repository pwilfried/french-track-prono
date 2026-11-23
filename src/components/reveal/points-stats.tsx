import { messages } from "@/app/messages.fr";
import type { EventPointsStats } from "@/domain/event-result";
import { cn } from "@/lib/utils";

const text = messages.pointsStats;

/**
 * What all the players scored on an event (#1155): my place among them, then the spread of the
 * points by range (mine highlighted), the mean and the perfect podiums.
 */
export function PointsStats({ stats }: { stats: EventPointsStats }) {
  if (stats.total === 0) return null;
  return (
    <div className="mx-4 flex flex-col gap-3">
      {stats.me ? (
        <section
          aria-label={text.myPlaceTitle}
          className="flex flex-col gap-3 rounded-card border border-white/15 bg-nuit p-4 text-white"
        >
          <h3 className="text-xs font-bold uppercase tracking-wider text-white/75">
            {text.myPlaceTitle}
          </h3>
          <p className="font-mono text-2xl font-bold tabular-nums">
            {text.myPlace(stats.me.rank, stats.total)}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <p className="rounded-xl bg-white/10 p-2.5 text-sm font-semibold">
              {text.top(stats.me.topPercent)}
            </p>
            <p className="rounded-xl bg-white/10 p-2.5 text-sm font-semibold">
              {text.mean(stats.mean)}
            </p>
          </div>
        </section>
      ) : (
        <p className="text-sm font-semibold">{text.meanOnly(stats.mean)}</p>
      )}
      <section className="flex flex-col gap-2 rounded-card border border-border bg-card p-4">
        <h3 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
          {text.spreadTitle}
        </h3>
        <ul className="flex flex-col gap-1.5">
          {stats.ranges.map((range) => {
            const label = text.range(range.min, range.max);
            return (
              <li
                key={range.min}
                aria-label={text.rangeRow(label, range.count, range.percent, range.mine)}
                aria-current={range.mine ? "true" : undefined}
                className="grid grid-cols-[4rem_1fr_3rem] items-center gap-2 text-sm"
              >
                <span className="font-mono tabular-nums">{label}</span>
                <span className="h-3 overflow-hidden rounded-full bg-muted dark:bg-background">
                  <span
                    className={cn(
                      "block h-full rounded-full",
                      range.mine ? "bg-secondary" : "bg-brand",
                    )}
                    style={{ width: `${range.percent}%` }}
                  />
                </span>
                <span className="text-right font-mono tabular-nums">
                  {text.percent(range.percent)}
                </span>
              </li>
            );
          })}
        </ul>
        <p className="text-sm text-muted-foreground">{text.perfect(stats.perfect)}</p>
      </section>
    </div>
  );
}
