import Link from "next/link";
import { useId } from "react";

import type { PodiumHits } from "@/application/list-my-predictions";
import { LockLine } from "@/components/countdown/lock-line";
import { TIME_ZONE } from "@/domain/competition";
import { countdown, eventPhase } from "@/domain/countdown";
import type { EventSummary } from "@/domain/event";
import { messages } from "@/app/messages.fr";
import { cn } from "@/lib/utils";

import { ChipStatus } from "../ui/chip-status";

/**
 * What the signed-in player did on this event, and the points won with what the podium got right
 * once computed; absent for a visitor.
 */
export type MyEventState = {
  predicted: boolean;
  joker: boolean;
  points?: number | null;
  hits?: PodiumHits | null;
};

/**
 * One event of the list (#546): the hour in mono, the name and a line under it, one status on the
 * right. An event to run says when it locks (« modifiable » once posed) with « + Prono » or
 * « ✓ Posé »; a finished one sits on a muted background with my result and my points.
 * A green edge marks a podium already in, a red edge an imminent lock.
 * `now` fixes the state for a first render or a story; the lock line itself ticks on the client.
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
  const id = useId();

  let status: React.ReactNode;
  if (finished)
    status =
      mine && !predicted ? (
        <ChipStatus tone="neutral">{messages.events.noPoints}</ChipStatus>
      ) : points === null ? (
        <ChipStatus tone="neutral">{messages.events.status.finished}</ChipStatus>
      ) : (
        <ChipStatus tone={points > 0 ? "ok" : "neutral"}>{messages.points.line(points)}</ChipStatus>
      );
  else if (predicted) status = <ChipStatus tone="ok">{messages.events.posed}</ChipStatus>;
  else if (event.status === "live")
    status = <ChipStatus tone="hot">{messages.events.status.live}</ChipStatus>;
  else if (open) status = <ChipStatus tone="brand">{messages.events.addPrediction}</ChipStatus>;
  else status = <ChipStatus tone="neutral">{`🔒 ${messages.countdown.locked}`}</ChipStatus>;

  // The line under the name: my result once finished, else when it locks.
  const hits = mine?.hits;
  let line: React.ReactNode = null;
  if (finished) {
    if (mine && !predicted) line = messages.events.noPrediction;
    else if (hits)
      line = hits.perfect
        ? messages.events.perfect
        : messages.playerHome.lastResult.detail(hits.exact, hits.onPodium, event.gender);
  } else if (open)
    line = (
      <>
        <LockLine lockAt={event.lockAt} now={tick ? undefined : now} />
        {predicted && ` · ${messages.events.editable}`}
      </>
    );

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
        // Named by the event, then by the status shown on the right (#517).
        aria-labelledby={`${id}-name ${id}-status`}
      >
        <span id={`${id}-name`} hidden>
          {messages.events.cardLabel(messages.events.name(event.discipline, event.gender), hour)}
        </span>
        <span className="font-mono text-base font-bold leading-none tabular-nums">{hour}</span>
        <div className="min-w-0">
          <p className="break-words font-display text-base font-bold leading-tight">
            {messages.events.name(event.discipline, event.gender)}
          </p>
          <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted-foreground">
            {line && <span>{line}</span>}
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
        <div id={`${id}-status`} className="flex justify-end">
          {status}
        </div>
      </Link>
    </li>
  );
}
