"use client";

import { messages } from "@/app/messages.fr";
import { countdown, lockAlert, splitDuration } from "@/domain/countdown";
import { cn } from "@/lib/utils";

import { useNow } from "./use-now";

const two = (n: number) => String(n).padStart(2, "0");

/**
 * Band of an open event (board 03): « Verrouillage dans 00:12:04 », ticking every second
 * unless `now` is given. Neutral more than one hour ahead, red in the last hour (#989). Once
 * locked it turns into a quiet « Verrouillé ». Nothing blinks.
 */
export function LockBanner({ lockAt, now }: { lockAt: string; now?: Date }) {
  const state = countdown(useNow(now), lockAt);
  if (state.phase === "locked") {
    return (
      <p className="flex min-h-12 items-center gap-2 rounded-2xl bg-countdown-locked px-4 font-bold text-countdown-locked-foreground">
        <span aria-hidden="true">🔒</span>
        {messages.countdown.locked}
      </p>
    );
  }
  const alert = lockAlert(state);
  const { days, hours, minutes, seconds } = splitDuration(state.remainingSeconds);
  const clock = `${days > 0 ? `${days} ${messages.countdown.day} ` : ""}${two(hours)}:${two(minutes)}:${two(seconds)}`;
  return (
    <p
      role="timer"
      aria-live="off"
      data-alert={alert}
      suppressHydrationWarning
      className={cn(
        "flex min-h-12 items-center justify-between gap-3 rounded-2xl px-4 font-bold transition-colors motion-reduce:transition-none",
        alert
          ? "bg-countdown-very-soon text-countdown-very-soon-foreground"
          : "bg-muted text-foreground",
      )}
    >
      <span className="flex items-center gap-2">
        <span aria-hidden="true">⏱</span>
        {messages.countdown.locksInLabel}
      </span>
      <span suppressHydrationWarning className="font-mono text-lg tabular-nums">
        {clock}
      </span>
    </p>
  );
}
