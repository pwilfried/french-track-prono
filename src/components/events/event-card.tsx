import Link from "next/link";
import { useId } from "react";

import type { AthleteName } from "@/application/get-athlete";
import type { PodiumHits } from "@/application/list-my-predictions";
import { Animal } from "@/components/band/animal";
import { LockLine } from "@/components/countdown/lock-line";
import { eventAnimal } from "@/domain/band";
import { TIME_ZONE } from "@/domain/competition";
import { countdown, eventPhase } from "@/domain/countdown";
import type { DisciplineFamily } from "@/domain/discipline";
import type { EventSummary } from "@/domain/event";
import { shortAthleteName } from "@/domain/manager-team";
import { messages } from "@/app/messages.fr";
import { cn } from "@/lib/utils";

import { ChipStatus } from "../ui/chip-status";

/**
 * What the signed-in player did on this event: the points won with what the podium got right
 * once computed, and the athletes of the podium (null: « autre athlète »); absent for a visitor.
 */
export type MyEventState = {
  predicted: boolean;
  joker: boolean;
  points?: number | null;
  hits?: PodiumHits | null;
  podium?: (AthleteName | null)[];
};

/**
 * One event of the list (#546): the hour in mono over the animal of its family (#800), the name
 * and a line under it, one status on the right. An event to predict counts down to its lock with
 * « + Prono »; once posed, my podium in short names, « modifiable », and « ✓ Posé »; a finished
 * one sits on a muted background with its winner, my result and my points, or « Pas joué » and
 * nothing on the right when I had no podium (#707).
 * A green edge marks a podium already in, a red edge an imminent lock.
 * `now` fixes the state for a first render or a story; the lock line itself ticks on the client.
 */
export function EventCard({
  event,
  family,
  mine,
  now = new Date(),
  tick = true,
}: {
  event: EventSummary;
  /** The family of its discipline; unknown or a relay: the hare, the mascot. */
  family?: DisciplineFamily | null;
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

  // The right side: my points once computed, the cue while open, nothing for an event not played.
  const notPlayed = finished && mine !== undefined && !predicted;
  let status: React.ReactNode = null;
  if (notPlayed) status = null;
  else if (finished)
    status =
      points === null ? (
        <ChipStatus tone="neutral">{messages.events.status.finished}</ChipStatus>
      ) : (
        <ChipStatus tone={points > 0 ? "ok" : "neutral"}>{messages.points.line(points)}</ChipStatus>
      );
  else if (predicted) status = <ChipStatus tone="ok">{messages.events.posed}</ChipStatus>;
  else if (event.status === "live")
    status = <ChipStatus tone="hot">{messages.events.status.live}</ChipStatus>;
  else if (open) status = <ChipStatus tone="brand">{messages.events.addPrediction}</ChipStatus>;
  else status = <ChipStatus tone="neutral">{`🔒 ${messages.countdown.locked}`}</ChipStatus>;

  // The line under the name: my result once finished, else my podium or the time left to lock.
  const hits = mine?.hits;
  const podium = mine?.podium;
  let line: React.ReactNode = null;
  if (finished) {
    if (notPlayed) line = messages.events.notPlayed;
    else if (hits)
      line = hits.perfect
        ? messages.events.perfect
        : messages.playerHome.lastResult.detail(hits.exact, hits.onPodium, event.gender);
  } else if (open && predicted)
    line = podium?.length
      ? `${messages.events.myPodium(
          podium.map((a) => (a ? shortAthleteName(a.name) : messages.events.otherAthlete)),
        )} · ${messages.events.editable}`
      : messages.events.editable;
  else if (open) line = <LockLine lockAt={event.lockAt} now={tick ? undefined : now} timeLeft />;
  const winner = finished ? event.winner : null;

  return (
    <li>
      <Link
        href={`/epreuves/${event.slug}`}
        className={cn(
          "grid min-h-16 grid-cols-[56px_1fr_auto] items-center gap-3 rounded-card border border-border bg-card p-3.5 text-card-foreground outline-offset-2 focus-visible:outline-2 focus-visible:outline-ring",
          finished && "bg-muted",
          predicted && !finished && "border-l-4 border-l-success",
          !predicted && imminent && "border-l-4 border-l-primary",
        )}
        // Named by the event, then by the status shown on the right (#517), or « Pas joué ».
        aria-labelledby={`${id}-name ${status ? `${id}-status` : `${id}-line`}`}
      >
        <span id={`${id}-name`} hidden>
          {messages.events.cardLabel(messages.events.name(event.discipline, event.gender), hour)}
        </span>
        <span className="flex flex-col items-center gap-1.5">
          <span className="font-mono text-base font-bold leading-none tabular-nums">{hour}</span>
          <Animal kind={eventAnimal(family)} className="size-7" />
        </span>
        <div className="min-w-0">
          <p className="break-words font-display text-base font-bold leading-tight">
            {messages.events.name(event.discipline, event.gender)}
          </p>
          {winner && (
            <p className="mt-1 break-words text-xs font-bold">
              {messages.events.winner(winner.name)}
            </p>
          )}
          <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted-foreground">
            {line && (
              <span id={`${id}-line`} className="min-w-0 break-words">
                {line}
              </span>
            )}
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
        {status ? (
          <div id={`${id}-status`} className="flex justify-end">
            {status}
          </div>
        ) : (
          <span aria-hidden />
        )}
      </Link>
    </li>
  );
}
