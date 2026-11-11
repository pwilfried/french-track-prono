import Link from "next/link";

import { CountdownBadge } from "@/components/countdown/countdown-badge";
import { TIME_ZONE } from "@/domain/competition";
import { countdown, eventPhase } from "@/domain/countdown";
import type { EventSummary } from "@/domain/event";
import { messages } from "@/app/messages.fr";
import { cn } from "@/lib/utils";

import { ChipStatus } from "../ui/chip-status";

/** What the signed-in player did on this event, and the points won once computed; absent for a visitor. */
export type MyEventState = { predicted: boolean; joker: boolean; points?: number | null };

/**
 * One event of the list (Officiel boards, screen 02): time block in mono, discipline and meta,
 * one status on the right. A green edge marks a podium already in, a red edge an imminent lock; a
 * finished event sits on a muted background with « Terminé » or the points won (#488).
 * `now` fixes the state for a first render or a story; the countdown itself ticks on the client.
 */
export function EventCard({
  event,
  mine,
  now = new Date(),
  tick = true,
}: {
  event: EventSummary;
  mine?: MyEventState;
  now?: Date;
  /** False in stories and screenshots, so the countdown stays on `now`. */
  tick?: boolean;
}) {
  const hour = new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TIME_ZONE,
  }).format(new Date(event.startsAt));
  const open = eventPhase(now, event.lockAt) === "open";
  const left = countdown(now, event.lockAt);
  const imminent = left.phase === "open" && left.level === "very-soon";
  const predicted = mine?.predicted ?? false;
  const finished = event.status === "finished";
  const points = mine?.points ?? null;

  let status: React.ReactNode;
  if (finished)
    status =
      points === null ? (
        <ChipStatus tone="neutral">{messages.events.status.finished}</ChipStatus>
      ) : (
        <ChipStatus tone={points > 0 ? "ok" : "neutral"}>{messages.points.line(points)}</ChipStatus>
      );
  else if (predicted) status = <ChipStatus tone="ok">{messages.events.posed}</ChipStatus>;
  else if (event.status === "live")
    status = <ChipStatus tone="hot">{messages.events.status.live}</ChipStatus>;
  else if (open && mine && !imminent)
    status = <ChipStatus tone="brand">{messages.events.addPrediction}</ChipStatus>;
  else status = <CountdownBadge lockAt={event.lockAt} now={tick ? undefined : now} compact />;

  return (
    <li>
      <Link
        href={`/epreuves/${event.slug}`}
        className={cn(
          "grid min-h-16 grid-cols-[64px_1fr_auto] items-center gap-3 rounded-card border border-border bg-card p-3.5 text-card-foreground outline-offset-2 focus-visible:outline-2 focus-visible:outline-ring",
          finished && "bg-muted",
          predicted && !finished && "border-l-4 border-l-success",
          !predicted && imminent && "border-l-4 border-l-primary",
        )}
        aria-label={messages.events.cardLabel(
          event.discipline,
          messages.events.gender[event.gender],
          hour,
        )}
      >
        <div className="flex flex-col items-start gap-0.5">
          <span className="font-mono text-base font-bold leading-none tabular-nums">{hour}</span>
          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {messages.events.final}
          </span>
        </div>
        <div className="min-w-0">
          <p className="break-words font-display text-base font-bold leading-tight">
            {event.discipline}
          </p>
          <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted-foreground">
            <span className="font-bold text-foreground/80">
              {messages.events.genderInitial[event.gender]}
            </span>
            {event.isFeatured && (
              <span className="font-bold text-accent-text">★ {messages.events.featured}</span>
            )}
            {mine?.joker && (
              <span className="rounded-full bg-gold-soft px-2 py-0.5 text-[10px] font-extrabold text-gold-ink">
                {messages.myPredictions.joker}
              </span>
            )}
          </p>
        </div>
        <div className="flex justify-end">{status}</div>
      </Link>
    </li>
  );
}
