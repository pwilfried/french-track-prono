"use client";

import { messages } from "@/app/messages.fr";
import { countdown, splitDuration } from "@/domain/countdown";

import { useNow } from "./use-now";

const two = (n: number) => String(n).padStart(2, "0");

/**
 * Red band of an open event (board 03): « Verrouillage dans 00:12:04 », ticking every second
 * unless `now` is given. Once locked it turns into a quiet « Verrouillé ». Nothing blinks.
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
  const { days, hours, minutes, seconds } = splitDuration(state.remainingSeconds);
  const clock = `${days > 0 ? `${days} ${messages.countdown.day} ` : ""}${two(hours)}:${two(minutes)}:${two(seconds)}`;
  return (
    <p
      role="timer"
      aria-live="off"
      suppressHydrationWarning
      className="flex min-h-12 items-center justify-between gap-3 rounded-2xl bg-countdown-very-soon px-4 font-bold text-countdown-very-soon-foreground"
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
