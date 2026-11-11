import { utcToParis } from "@/domain/competition";
import type { EventDetail } from "@/domain/event";
import { ROUNDS } from "@/domain/rounds";

import { messages } from "../../messages.fr";
import { deleteEventAction, editEventAction } from "../competitions/actions";

const field = "min-h-12 w-full rounded-xl border-2 border-border bg-card px-3 text-base";
const LOCKS = [0, 5, 15, 30, 60];

/** Correct an event (#293): round, Paris time, lock; delete it while nobody predicted it. */
export function EventEdit({ event }: { event: EventDetail }) {
  const t = messages.adminCompetitions;
  const lock = Math.round((Date.parse(event.startsAt) - Date.parse(event.lockAt)) / 60000);
  const locks = LOCKS.includes(lock) ? LOCKS : [...LOCKS, lock].sort((a, b) => a - b);
  return (
    <details className="rounded-card border-2 border-dashed border-border p-3.5">
      <summary className="flex min-h-11 cursor-pointer items-center font-bold">
        {t.editEvent}
      </summary>
      <form action={editEventAction} className="flex flex-col gap-3 pt-2">
        <input type="hidden" name="eventSlug" value={event.slug} />
        <p className="text-sm text-muted-foreground">{t.editEventHint}</p>
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          {t.round}
          <select name="round" defaultValue={event.round} className={field}>
            {ROUNDS.map((r) => (
              <option key={r} value={r}>
                {messages.rounds.name[r]}
              </option>
            ))}
          </select>
        </label>
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            {t.localStart}
            <input
              type="datetime-local"
              name="localStart"
              required
              defaultValue={utcToParis(event.startsAt)}
              className={field}
            />
          </label>
          <p className="-mt-1.5 text-sm text-muted-foreground">{t.timeHint}</p>
          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            {t.lock}
            <select name="lockMinutes" defaultValue={String(lock)} className={field}>
              {locks.map((m) => (
                <option key={m} value={m}>
                  {t.lockBefore(m)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <button
          type="submit"
          className="min-h-12 rounded-full bg-brand font-bold text-brand-foreground"
        >
          {t.editEventSubmit}
        </button>
      </form>
      <form
        action={deleteEventAction}
        className="mt-4 flex flex-col gap-2 border-t border-border pt-3"
      >
        <input type="hidden" name="eventSlug" value={event.slug} />
        <input type="hidden" name="competition" value={event.competitionSlug ?? ""} />
        <p className="text-sm text-muted-foreground">{t.deleteEventHint}</p>
        <button
          type="submit"
          className="min-h-12 rounded-full border-2 border-primary font-bold text-accent-text"
        >
          {t.deleteEvent}
        </button>
      </form>
    </details>
  );
}
