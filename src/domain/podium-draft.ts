export type Step = 1 | 2 | 3;

/** A podium being composed: athlete ids on the three steps, any of them may still be empty. */
export type PodiumDraft = { first: string | null; second: string | null; third: string | null };

/** A complete podium, ready to be saved. */
export type Podium = { first: string; second: string; third: string };

/** The marks a player predicts for the athletes of his podium (null: no mark). */
export type PodiumMarks = { first: number | null; second: number | null; third: number | null };

const KEY = { 1: "first", 2: "second", 3: "third" } as const;

export function emptyDraft(): PodiumDraft {
  return { first: null, second: null, third: null };
}

export function draftFromPodium(podium: Podium): PodiumDraft {
  return { ...podium };
}

/**
 * Puts an athlete on a step. An athlete is never on two steps: if he was on another step he
 * moves (and swaps with whoever was on the target step); if he comes from outside, he replaces
 * whoever was on the target step.
 */
export function placeAthlete(draft: PodiumDraft, step: Step, athleteId: string): PodiumDraft {
  const target = KEY[step];
  const from = (Object.keys(draft) as (keyof PodiumDraft)[]).find(
    (key) => draft[key] === athleteId,
  );
  if (from === target) return draft;
  const next = { ...draft, [target]: athleteId };
  if (from) next[from] = draft[target];
  return next;
}

export function removeStep(draft: PodiumDraft, step: Step): PodiumDraft {
  return { ...draft, [KEY[step]]: null };
}

export function swapSteps(draft: PodiumDraft, a: Step, b: Step): PodiumDraft {
  return { ...draft, [KEY[a]]: draft[KEY[b]], [KEY[b]]: draft[KEY[a]] };
}

export function isComplete(draft: PodiumDraft): boolean {
  return toPodium(draft) !== null;
}

/** The podium to save, or null while a step is empty. */
export function toPodium(draft: PodiumDraft): Podium | null {
  const { first, second, third } = draft;
  if (first === null || second === null || third === null) return null;
  return { first, second, third };
}

/** The first empty step, where the next tapped athlete goes; null when the podium is complete. */
export function nextEmptyStep(draft: PodiumDraft): Step | null {
  if (draft.first === null) return 1;
  if (draft.second === null) return 2;
  if (draft.third === null) return 3;
  return null;
}

/** The step an athlete is on, or null. */
export function stepOf(draft: PodiumDraft, athleteId: string): Step | null {
  if (draft.first === athleteId) return 1;
  if (draft.second === athleteId) return 2;
  if (draft.third === athleteId) return 3;
  return null;
}

/** A podium can be saved when its three athletes are given and all different. */
export function isValidPodium(podium: Podium): boolean {
  const ids = [podium.first, podium.second, podium.third];
  return ids.every((id) => id.length > 0) && new Set(ids).size === 3;
}

/**
 * « Autre athlète »: with odds, a place can go to any athlete outside the proposed ones. It stands
 * in the podium like an athlete id, so it can only be on one place.
 */
export const OTHER_ATHLETE = "other";
