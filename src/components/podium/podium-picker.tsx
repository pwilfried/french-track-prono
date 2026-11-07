"use client";

import { useState } from "react";

import { messages } from "@/app/messages.fr";
import type { Entry } from "@/domain/event";
import {
  emptyDraft,
  nextEmptyStep,
  placeAthlete,
  removeStep,
  stepOf,
  type PodiumDraft,
  type Step,
} from "@/domain/podium-draft";
import { cn } from "@/lib/utils";

const MEDAL = { 1: "🥇", 2: "🥈", 3: "🥉" } as const;
const KEY = { 1: "first", 2: "second", 3: "third" } as const;
// Display order: second on the left, winner in the middle, third on the right.
const DISPLAY: Step[] = [2, 1, 3];
const STEP_HEIGHT = { 1: "min-h-29", 2: "min-h-24", 3: "min-h-21" } as const;

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
}: {
  athletes: Entry[];
  initialDraft?: PodiumDraft;
  error?: string;
  disabled?: boolean;
  onChange?: (draft: PodiumDraft) => void;
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

  return (
    <div className="flex flex-col gap-3">
      <h2 className="px-4 text-xs font-bold tracking-wider text-muted-foreground uppercase">
        {messages.picker.podium}
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
                "flex min-w-0 flex-col items-center justify-center gap-1 rounded-[18px] border-2 bg-card px-1 py-2 text-center text-[13px] font-bold transition-shadow motion-reduce:transition-none",
                STEP_HEIGHT[step],
                athlete ? "border-solid border-primary bg-muted" : "border-dashed border-border",
                active === step && !disabled && "border-primary ring-3 ring-primary/25",
              )}
            >
              <span aria-hidden className="text-[22px]">
                {MEDAL[step]}
              </span>
              {athlete ? (
                <>
                  <span className="line-clamp-2 break-words hyphens-auto">{athlete.name}</span>
                  <span className="text-[11px] font-semibold text-muted-foreground">
                    {athlete.countryCode}
                  </span>
                </>
              ) : (
                <span className="text-xs font-semibold text-muted-foreground">
                  {messages.picker.emptyStep}
                </span>
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
        {messages.picker.athletes}
      </h2>
      <ul className="flex flex-col gap-2 px-4">
        {athletes.map((athlete) => {
          const rank = stepOf(draft, athlete.athleteId);
          return (
            <li key={athlete.athleteId}>
              <button
                type="button"
                disabled={disabled}
                aria-label={messages.picker.athleteLabel(athlete.name, rank)}
                aria-pressed={rank !== null}
                onClick={() => tapAthlete(athlete.athleteId)}
                className={cn(
                  "flex min-h-14 w-full items-center gap-3 rounded-2xl border-2 bg-card px-3.5 py-1.5 text-left",
                  rank !== null ? "border-primary bg-muted" : "border-border",
                )}
              >
                <span className="min-w-0 flex-1">
                  <span className="block font-bold break-words">{athlete.name}</span>
                  <span className="block text-[13px] text-muted-foreground">
                    {athlete.countryCode}
                    {athlete.seasonBest ? ` · ${athlete.seasonBest}` : ""}
                  </span>
                </span>
                {rank !== null && (
                  <span
                    aria-hidden
                    className="grid size-8 shrink-0 place-items-center rounded-full bg-primary font-extrabold text-primary-foreground"
                  >
                    {rank}
                  </span>
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
