"use client";

import { messages } from "@/app/messages.fr";
import { countdown, splitDuration } from "@/domain/countdown";
import { useNow } from "@/components/countdown/use-now";

/** Big figures « DANS 12 J 04 H 22 MIN » until the next lock; refreshes every 30 s. */
export function LockCountdown({ lockAt, now }: { lockAt: string; now?: Date }) {
  const state = countdown(useNow(now, 30_000), lockAt);
  if (state.phase === "locked") return null;
  const { days, hours, minutes } = splitDuration(state.remainingSeconds);
  const parts = [
    [days, messages.home.days],
    [hours, messages.home.hours],
    [minutes, messages.home.minutes],
  ] as const;
  return (
    <p
      className="flex items-baseline gap-2"
      aria-label={messages.home.countdownLabel(days, hours, minutes)}
    >
      <span aria-hidden="true" className="text-xs font-bold uppercase tracking-wide text-[#dce6f5]">
        {messages.home.in}
      </span>
      {parts.map(([value, unit]) => (
        <span key={unit} aria-hidden="true" className="flex items-baseline gap-1">
          <span className="font-mono text-3xl font-bold tabular-nums text-secondary">
            {String(value).padStart(2, "0")}
          </span>
          <span className="text-xs font-bold uppercase text-[#dce6f5]">{unit}</span>
        </span>
      ))}
    </p>
  );
}
