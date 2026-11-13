import { LockLine } from "@/components/countdown/lock-line";
import type { EventsProgress } from "@/domain/event-list";
import { messages } from "@/app/messages.fr";

const text = messages.events.progress;
const soft = "text-[#d9e4f5]";

/**
 * Where the player stands in the competition (#546), on the FrenchTrack blue: the podiums posed, the
 * points (before the competition: the days to the first finals), then what is left tonight.
 * `now` fixes the lock line for a story; it ticks on the client otherwise.
 */
export function ProgressCard({ progress, now }: { progress: EventsProgress; now?: Date }) {
  const { posed, total, points, daysToStart, tonight } = progress;
  return (
    <section
      aria-labelledby="progress-title"
      className="flex flex-col gap-2.5 rounded-card bg-brand p-4 text-brand-foreground"
    >
      <h2 id="progress-title" className="sr-only">
        {text.title}
      </h2>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="font-display text-lg font-extrabold">{text.posed(posed, total)}</p>
        <p className={`font-mono text-sm font-bold tabular-nums ${soft}`}>
          {daysToStart === null ? text.points(points) : text.start(daysToStart)}
        </p>
      </div>
      <span aria-hidden="true" className="h-2 rounded-full bg-white/20">
        <span
          className="block h-2 rounded-full bg-white"
          style={{ width: `${total > 0 ? (posed / total) * 100 : 0}%` }}
        />
      </span>
      <p className={`text-sm ${soft}`}>
        {daysToStart !== null ? (
          text.open
        ) : tonight.nextLockAt ? (
          <>
            {text.tonight(tonight.todo)}, <LockLine lockAt={tonight.nextLockAt} now={now} next />
          </>
        ) : (
          text.tonight(0)
        )}
      </p>
    </section>
  );
}
