import Link from "next/link";

import { messages } from "@/app/messages.fr";
import type { ProgramDay } from "@/domain/program";
import { cn } from "@/lib/utils";

const text = messages.competitions.days;
const weekday = (day: string) =>
  new Date(`${day}T12:00:00Z`).toLocaleDateString("fr-FR", { weekday: "short", timeZone: "UTC" });
const fullDay = (day: string) =>
  new Date(`${day}T12:00:00Z`).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });

/**
 * The days of the competition as scrolling tabs (#659): the weekday (« AUJ. » for today) over the
 * date, a dot on a finished day and on today. Plain links (`?jour=`), so the page stays a server
 * component and a day can be shared.
 */
export function DayBar({
  days,
  selected,
  hrefOf,
}: {
  days: ProgramDay[];
  selected: string | null;
  hrefOf: (day: string) => string;
}) {
  if (days.length === 0) return null;
  return (
    <nav aria-label={text.label} className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none]">
      <ul className="flex gap-1.5">
        {days.map((d) => {
          const active = d.day === selected;
          const state = [d.today && text.todayLabel, d.done && text.doneLabel].filter(Boolean);
          return (
            <li key={d.day}>
              <Link
                href={hrefOf(d.day)}
                aria-current={active ? "date" : undefined}
                aria-label={[fullDay(d.day), ...state].join(", ")}
                className={cn(
                  "relative flex min-h-14 min-w-14 flex-col items-center justify-center rounded-2xl px-2 leading-none",
                  active
                    ? "bg-brand text-brand-foreground"
                    : "border border-border bg-card text-foreground",
                )}
              >
                <span
                  className={cn(
                    "text-[11px] font-bold uppercase",
                    !active && (d.today ? "text-primary-ink" : "text-muted-foreground"),
                  )}
                >
                  {d.today ? text.today : weekday(d.day).replace(".", "")}
                </span>
                <span className="mt-1 font-display text-lg font-extrabold tabular-nums">
                  {Number(d.day.slice(8, 10))}
                </span>
                {(d.done || d.today) && (
                  <span
                    aria-hidden="true"
                    className={cn(
                      "absolute right-1.5 top-1.5 size-1.5 rounded-full",
                      d.today ? "bg-primary" : active ? "bg-white" : "bg-success",
                    )}
                  />
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** The days bar while the page loads. */
export function DayBarSkeleton({ days = 4 }: { days?: number }) {
  return (
    <div className="flex gap-1.5" aria-hidden="true">
      {Array.from({ length: days }, (_, i) => (
        <span
          key={i}
          className="size-14 animate-pulse rounded-2xl bg-muted motion-reduce:animate-none"
        />
      ))}
    </div>
  );
}
