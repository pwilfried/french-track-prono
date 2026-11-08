"use client";

import { useState } from "react";

import { messages } from "@/app/messages.fr";
import type { Entry } from "@/domain/event";
import { flagOf } from "@/domain/flag";
import {
  emptyDraft,
  nextEmptyStep,
  OTHER_ATHLETE,
  placeAthlete,
  removeStep,
  stepOf,
  type PodiumDraft,
  type Step,
} from "@/domain/podium-draft";
import { cn } from "@/lib/utils";

const MEDAL_STYLE = {
  1: "bg-gradient-to-b from-(--medal-gold-from) to-(--medal-gold-to) text-(--medal-gold-ink) border-transparent",
  2: "bg-gradient-to-b from-(--medal-silver-from) to-(--medal-silver-to) text-(--medal-silver-ink) border-transparent",
  3: "bg-gradient-to-b from-(--medal-bronze-from) to-(--medal-bronze-to) text-(--medal-bronze-ink) border-transparent",
} as const;
const KEY = { 1: "first", 2: "second", 3: "third" } as const;
// Display order: second on the left, winner in the middle, third on the right.
const DISPLAY: Step[] = [2, 1, 3];
const STEP_HEIGHT = { 1: "min-h-32", 2: "min-h-28", 3: "min-h-24" } as const;

/** An athlete to choose; with odds, also his odds and PR (« autre athlète » is one of them). */
export type PickerAthlete = Entry & { odds?: number | null; personalBest?: string | null };

/**
 * Compose a podium by tapping: athletes go on the selected step (by default the first empty one),
 * a placed athlete is removed by tapping it again, a step is selected by tapping it. No drag and
 * drop. Hidden inputs `first`, `second`, `third` carry the podium in a form.
 */
export function PodiumPicker({
  athletes,
  initialDraft = emptyDraft(),
  error,
  disabled = false,
  onChange,
  title = messages.picker.podium,
}: {
  athletes: PickerAthlete[];
  initialDraft?: PodiumDraft;
  error?: string;
  disabled?: boolean;
  onChange?: (draft: PodiumDraft) => void;
  /** Heading above the steps ("Ton podium" by default). */
  title?: string;
}) {
  const [draft, setDraft] = useState(initialDraft);
  const [selected, setSelected] = useState<Step | null>(null);
  const active = selected ?? nextEmptyStep(draft);
  const nameOf = (id: string | null) => athletes.find((a) => a.athleteId === id) ?? null;

  const update = (next: PodiumDraft) => {
    setDraft(next);
    setSelected(null);
    onChange?.(next);
  };

  const tapAthlete = (athleteId: string) => {
    const placedOn = stepOf(draft, athleteId);
    if (placedOn !== null && selected === null) return update(removeStep(draft, placedOn));
    if (active === null) return;
    update(placeAthlete(draft, active, athleteId));
  };

  const complete = nextEmptyStep(draft) === null;
  const withOdds = athletes.some((a) => a.odds != null);

  return (
    <div className="flex flex-col gap-3">
      <h2 className="px-4 text-xs font-bold tracking-wider text-muted-foreground uppercase">
        {title}
      </h2>
      <div className="grid grid-cols-3 items-end gap-2.5 px-4">
        {DISPLAY.map((step) => {
          const athlete = nameOf(draft[KEY[step]]);
          return (
            <button
              key={step}
              type="button"
              disabled={disabled}
              aria-pressed={active === step}
              aria-label={messages.picker.stepLabel(step, athlete?.name ?? null)}
              onClick={() => setSelected(selected === step ? null : step)}
              className={cn(
                "flex min-w-0 flex-col items-center justify-start gap-1 rounded-t-2xl rounded-b-lg border-2 px-1 py-2 text-center text-[13px] font-bold transition-shadow motion-reduce:transition-none",
                STEP_HEIGHT[step],
                athlete
                  ? MEDAL_STYLE[step]
                  : "border-dashed border-border bg-card text-muted-foreground",
                active === step && !disabled && "ring-3 ring-primary/40",
              )}
            >
              <span aria-hidden className="font-display text-2xl font-extrabold">
                {step}
              </span>
              {athlete ? (
                <>
                  <span aria-hidden className="text-lg leading-none">
                    {athlete.athleteId === OTHER_ATHLETE
                      ? "?"
                      : (flagOf(athlete.countryCode) ?? athlete.countryCode)}
                  </span>
                  <span className="line-clamp-2 break-words hyphens-auto">{athlete.name}</span>
                </>
              ) : (
                <span className="text-xs font-semibold">{messages.picker.emptyStep}</span>
              )}
            </button>
          );
        })}
      </div>

      {error && (
        <p role="alert" className="px-4 text-sm font-semibold text-accent-text">
          {error}
        </p>
      )}

      <h2 className="px-4 pt-2 text-xs font-bold tracking-wider text-muted-foreground uppercase">
        {withOdds ? messages.picker.proposed : messages.picker.athletes}
      </h2>
      {withOdds && !disabled && (
        <p className="px-4 text-sm text-muted-foreground">{messages.picker.oddsHint}</p>
      )}
      <ul className="flex flex-col gap-2 px-4">
        {athletes.map((athlete) => {
          const rank = stepOf(draft, athlete.athleteId);
          const other = athlete.athleteId === OTHER_ATHLETE;
          const label = messages.picker.athleteLabel(athlete.name, rank);
          return (
            <li key={athlete.athleteId}>
              <button
                type="button"
                disabled={disabled}
                aria-label={
                  athlete.odds != null
                    ? `${label}, ${messages.picker.oddsLabel(athlete.odds)}`
                    : label
                }
                aria-pressed={rank !== null}
                onClick={() => tapAthlete(athlete.athleteId)}
                className={cn(
                  "flex min-h-14 w-full items-center gap-3 rounded-2xl border px-3.5 py-2 text-left",
                  other ? "bg-brand-soft text-brand-ink" : "bg-card",
                  rank !== null ? "border-primary" : "border-border",
                )}
              >
                <span aria-hidden className="w-7 shrink-0 text-center text-xl leading-none">
                  {other
                    ? "?"
                    : (flagOf(athlete.countryCode) ?? (
                        <span className="text-xs font-bold">{athlete.countryCode}</span>
                      ))}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-bold break-words">{athlete.name}</span>
                  {other ? (
                    <span className="block text-xs">{messages.picker.otherHint}</span>
                  ) : (
                    (athlete.personalBest || athlete.seasonBest) && (
                      <span className="block font-mono text-xs text-muted-foreground">
                        {[
                          athlete.personalBest &&
                            messages.picker.personalBest(athlete.personalBest),
                          athlete.seasonBest && messages.picker.seasonBest(athlete.seasonBest),
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    )
                  )}
                </span>
                {athlete.odds != null && (
                  <span
                    aria-hidden
                    className="shrink-0 font-mono text-[15px] font-bold tabular-nums"
                  >
                    {messages.picker.odds(athlete.odds)}
                  </span>
                )}
                {rank !== null ? (
                  <span
                    aria-hidden
                    className="grid size-9 shrink-0 place-items-center rounded-full bg-primary font-extrabold text-primary-foreground"
                  >
                    {rank}
                  </span>
                ) : (
                  !disabled && (
                    <span
                      aria-hidden
                      className="shrink-0 rounded-full bg-brand-soft px-3 py-1.5 text-xs font-bold text-brand-ink"
                    >
                      {messages.picker.choose}
                    </span>
                  )
                )}
              </button>
            </li>
          );
        })}
      </ul>

      {!disabled && (
        <p className="mx-4 rounded-2xl bg-muted px-3.5 py-3 text-sm text-muted-foreground">
          {complete ? messages.picker.hintComplete : messages.picker.hint}
        </p>
      )}

      <input type="hidden" name="first" value={draft.first ?? ""} />
      <input type="hidden" name="second" value={draft.second ?? ""} />
      <input type="hidden" name="third" value={draft.third ?? ""} />
    </div>
  );
}
