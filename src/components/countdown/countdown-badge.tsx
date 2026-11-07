"use client";

import { useEffect, useState } from "react";

import { messages } from "@/app/messages.fr";
import { countdown, splitDuration, type CountdownLevel } from "@/domain/countdown";
import { cn } from "@/lib/utils";

const levelStyle: Record<CountdownLevel | "locked", string> = {
  far: "bg-muted text-foreground",
  soon: "bg-countdown-soon text-countdown-soon-foreground",
  "very-soon": "bg-countdown-very-soon text-countdown-very-soon-foreground",
  locked: "bg-countdown-locked text-countdown-locked-foreground",
};

/**
 * Time left before the predictions of an event lock. It ticks every second unless `now` is given
 * (stories, tests). Only the colour and the text change: nothing blinks.
 */
export function CountdownBadge({
  lockAt,
  now,
  compact = false,
}: {
  lockAt: string;
  now?: Date;
  /** Short label for lists: "42 min" instead of "Verrouillage dans 42 min". */
  compact?: boolean;
}) {
  const [tick, setTick] = useState(() => new Date());
  useEffect(() => {
    if (now) return;
    const id = setInterval(() => setTick(new Date()), 1000);
    return () => clearInterval(id);
  }, [now]);

  const state = countdown(now ?? tick, lockAt);
  const level = state.phase === "locked" ? "locked" : state.level;
  const duration =
    state.phase === "open"
      ? messages.countdown.duration(splitDuration(state.remainingSeconds))
      : "";
  const label =
    state.phase === "locked"
      ? `🔒 ${messages.countdown.locked}`
      : compact
        ? duration
        : messages.countdown.locksIn(duration);

  return (
    <span
      role="timer"
      aria-live="off"
      data-level={level}
      suppressHydrationWarning
      className={cn(
        "inline-flex items-center gap-2 rounded-full font-extrabold whitespace-nowrap transition-colors motion-reduce:transition-none",
        compact ? "min-h-7 px-2.5 text-xs" : "min-h-9 px-3.5 text-sm",
        levelStyle[level],
      )}
    >
      {label}
    </span>
  );
}
