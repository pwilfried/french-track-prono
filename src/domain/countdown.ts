/** Orange from one hour before the lock, red from ten minutes before. */
const SOON_SECONDS = 3600;
const VERY_SOON_SECONDS = 600;

export type EventPhase = "open" | "locked";
export type CountdownLevel = "far" | "soon" | "very-soon";
export type Countdown =
  { phase: "open"; remainingSeconds: number; level: CountdownLevel } | { phase: "locked" };

/** Locked from the lock time itself, like the database (`now() >= lock_at`). */
export function eventPhase(now: Date, lockAt: string): EventPhase {
  return now.getTime() >= Date.parse(lockAt) ? "locked" : "open";
}

/** Time left before the lock. A part of a second counts as a full second, so an open event never shows 0. */
export function countdown(now: Date, lockAt: string): Countdown {
  if (eventPhase(now, lockAt) === "locked") return { phase: "locked" };
  const remainingSeconds = Math.ceil((Date.parse(lockAt) - now.getTime()) / 1000);
  const level: CountdownLevel =
    remainingSeconds <= VERY_SOON_SECONDS
      ? "very-soon"
      : remainingSeconds <= SOON_SECONDS
        ? "soon"
        : "far";
  return { phase: "open", remainingSeconds, level };
}

export function splitDuration(totalSeconds: number) {
  return {
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
  };
}

export type LockLabel =
  { kind: "on" } | { kind: "in"; seconds: number; urgent: boolean } | { kind: "locked" };

/**
 * How an event card says when it locks (#546): its day and hour more than 24 hours ahead, else the
 * time left, urgent from one hour before, like the countdown turning orange.
 */
export function lockLabel(now: Date, lockAt: string): LockLabel {
  const left = countdown(now, lockAt);
  if (left.phase === "locked") return { kind: "locked" };
  if (left.remainingSeconds > 86_400) return { kind: "on" };
  return { kind: "in", seconds: left.remainingSeconds, urgent: left.level !== "far" };
}
