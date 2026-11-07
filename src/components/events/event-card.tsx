import Link from "next/link";

import { CountdownBadge } from "@/components/countdown/countdown-badge";
import type { EventSummary } from "@/domain/event";
import { messages } from "@/app/messages.fr";

import { ChipStatus, type ChipTone } from "../ui/chip-status";

/** What the signed-in player did on this event; absent for a visitor. */
export type MyEventState = { predicted: boolean; joker: boolean };

type StatusVisual = { tone: ChipTone; label: string };

/** Right-hand chip; mirrors the Officiel direction. Reads `messages.events.status` for finished/live. */
function statusOf(status: EventSummary["status"], mine?: MyEventState): StatusVisual {
  if (mine?.predicted) return { tone: "ok", label: messages.myPredictions.predicted };
  if (status === "finished") return { tone: "neutral", label: messages.events.status.finished };
  if (status === "live") return { tone: "hot", label: messages.events.status.live };
  return { tone: "brand", label: messages.myPredictions.toPredict };
}

/**
 * One event in a list. Grid: [time] [discipline + meta + joker badge] [status chip + countdown].
 * `now` stabilises the first server render; the CountdownBadge then ticks on the client.
 */
export function EventCard({
  event,
  timeZone,
  mine,
  now = new Date(),
}: {
  event: EventSummary;
  timeZone: string;
  mine?: MyEventState;
  now?: Date;
}) {
  const hour = new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  }).format(new Date(event.startsAt));
  const status = statusOf(event.status, mine);

  return (
    <li>
      <Link
        href={`/epreuves/${event.slug}`}
        className="grid min-h-16 grid-cols-[56px_1fr_auto] items-center gap-3 rounded-card border border-border bg-card p-3 text-card-foreground outline-offset-2 focus-visible:outline-2 focus-visible:outline-ring"
        aria-label={`${event.discipline} ${messages.events.gender[event.gender]} à ${hour}`}
      >
        <div className="flex flex-col items-center gap-0.5">
          <span className="font-sans text-base font-bold leading-none tabular-nums">{hour}</span>
          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Finale
          </span>
        </div>
        <div className="min-w-0">
          <p className="font-display text-base font-bold leading-tight">{event.discipline}</p>
          <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted-foreground">
            <span className="font-bold text-foreground/80">
              {messages.events.genderInitial[event.gender]}
            </span>
            {event.isFeatured && (
              <>
                <span aria-hidden="true" className="text-border">
                  ·
                </span>
                <span className="font-bold text-accent-text">★ {messages.events.featured}</span>
              </>
            )}
            {mine?.joker && (
              <span className="rounded-full bg-secondary/40 px-2 py-0.5 text-[10px] font-extrabold text-foreground">
                {messages.myPredictions.joker}
              </span>
            )}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          {event.status === "upcoming" && !mine?.predicted && (
            <CountdownBadge lockAt={event.lockAt} now={now} compact />
          )}
          <ChipStatus tone={status.tone}>{status.label}</ChipStatus>
        </div>
      </Link>
    </li>
  );
}
