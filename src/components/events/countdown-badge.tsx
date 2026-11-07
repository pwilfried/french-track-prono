import { countdown, splitDuration, type CountdownLevel } from "@/domain/countdown";
import { cn } from "@/lib/utils";

import { ChipStatus } from "../ui/chip-status";

/**
 * Compact countdown badge for event cards.
 * - Green/neutral far from lock, amber at ≤ 1 h, red at ≤ 10 min, grey when locked.
 * - Tabular numbers (inherited from body font-variant-numeric) so the width doesn't jitter live.
 * Rendered server-side with `now` injected so the first paint is stable; a parent that wants it
 * to tick refreshes `now` client-side.
 */

const levelTone: Record<CountdownLevel, "ghost" | "gold" | "hot"> = {
  far: "ghost",
  soon: "gold",
  "very-soon": "hot",
};

export function CountdownBadge({
  lockAt,
  now = new Date(),
  className,
}: {
  lockAt: string;
  now?: Date;
  className?: string;
}) {
  const state = countdown(now, lockAt);
  if (state.phase === "locked") {
    return (
      <ChipStatus tone="neutral" className={className}>
        🔒 Verrouillé
      </ChipStatus>
    );
  }
  const d = splitDuration(state.remainingSeconds);
  return (
    <ChipStatus tone={levelTone[state.level]} className={cn(className)}>
      ⏱ {formatLeft(d)}
    </ChipStatus>
  );
}

function formatLeft(d: ReturnType<typeof splitDuration>): string {
  if (d.days > 0) return `${d.days} j ${d.hours} h`;
  if (d.hours > 0) return `${d.hours} h ${pad(d.minutes)}`;
  if (d.minutes > 0) return `-${d.minutes} min`;
  return `-${d.seconds} s`;
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}
