"use client";

import { messages } from "@/app/messages.fr";
import { TIME_ZONE } from "@/domain/competition";
import { lockLabel, splitDuration } from "@/domain/countdown";
import { cn } from "@/lib/utils";

import { useNow } from "./use-now";

const day = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: TIME_ZONE,
});
const hour = new Intl.DateTimeFormat("fr-FR", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: TIME_ZONE,
});

/**
 * When an event locks, in words (#546): its day and hour more than 24 hours ahead, else the time
 * left, in red from one hour before. It ticks every second unless `now` is given. `next` words it
 * for the progress card: « la prochaine verrouille dans … ».
 */
export function LockLine({
  lockAt,
  now,
  next = false,
}: {
  lockAt: string;
  now?: Date;
  next?: boolean;
}) {
  const label = lockLabel(useNow(now), lockAt);
  const at = new Date(lockAt);
  const text =
    label.kind === "locked"
      ? messages.countdown.locked
      : label.kind === "on"
        ? messages.events.locksOn(day.format(at), hour.format(at))
        : (next ? messages.events.nextLocksIn : messages.events.locksIn)(
            messages.countdown.duration(splitDuration(label.seconds)),
          );
  return (
    <span
      suppressHydrationWarning
      // Red on a card; the progress card is blue, so its sentence keeps its colour.
      className={cn(label.kind === "in" && label.urgent && !next && "font-bold text-accent-text")}
    >
      {text}
    </span>
  );
}
