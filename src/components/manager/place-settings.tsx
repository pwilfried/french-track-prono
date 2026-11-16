"use client";

import { useId } from "react";

import { messages } from "@/app/messages.fr";
import { buttonVariants } from "@/components/ui/button";
import { thresholdPoints, thresholdSense } from "@/domain/manager-bench";
import type { LineupDiscipline } from "@/domain/manager-lineup";
import type { ManagerSex } from "@/domain/manager-rules";
import { MARK_MAX_LENGTH, markInputMode, markRange, readMark } from "@/domain/mark-range";
import { cn } from "@/lib/utils";

const text = messages.lineup;

/** What the player is setting on a place, kept when the sheet closes until « Enregistrer ». */
export type PlaceDraft = {
  discipline: string | undefined;
  substituteId: string | null;
  thresholdOn: boolean;
  thresholdText: string;
  /** « Enregistrer » was tried: the threshold field says what is wrong with it. */
  checked: boolean;
};

export type SubstituteChoice = {
  athleteId: string;
  name: string;
  discipline: string;
  note: string;
  disabled: boolean;
};

/** Why a typed threshold cannot be one, or its value. */
export function readThreshold(
  draft: Pick<PlaceDraft, "thresholdText">,
  discipline: LineupDiscipline,
): number | string {
  const read = readMark(draft.thresholdText, discipline.unit, discipline.family, discipline.name);
  if (read === "bad_mark") return messages.errors.MARK_INVALID;
  if (read === "out_of_range") {
    const range = markRange(discipline.unit, discipline.family, discipline.name);
    return messages.picker.markOutOfRange(
      messages.picker.rangeMark(range.min, discipline.unit),
      messages.picker.rangeMark(range.max, discipline.unit),
      discipline.name,
    );
  }
  return read;
}

/**
 * The settings of a starter's place (#1035), in the sheet over the lineup: the discipline that
 * counts (a segmented choice when they are on more than one start list), their designated
 * substitute (the athletes of the same family, bench and reserve), and the optional tactical
 * replacement: the substitute comes in when the starter does worse than a mark, bounded by what
 * is plausible for the discipline, with what it is worth on the tables.
 */
export function PlaceSettings({
  name,
  sex,
  pb,
  sb,
  familyLabel,
  disciplines,
  discipline,
  substitutes,
  draft,
  divisor,
  onChange,
  onSave,
  onBack,
}: {
  name: string;
  sex: ManagerSex;
  pb: string | null;
  sb: string | null;
  familyLabel: string;
  disciplines: LineupDiscipline[];
  /** The discipline that counts with the draft, null when none is known. */
  discipline: LineupDiscipline | null;
  substitutes: SubstituteChoice[];
  draft: PlaceDraft;
  divisor: number;
  onChange: (draft: PlaceDraft) => void;
  onSave: () => void;
  onBack: () => void;
}) {
  const id = useId();
  const records = text.records(pb, sb);
  const substitute = substitutes.find((s) => s.athleteId === draft.substituteId);
  const sense = discipline ? thresholdSense(discipline.family) : "slower";
  const read =
    discipline && draft.thresholdText.trim() !== "" ? readThreshold(draft, discipline) : null;
  const points =
    typeof read === "number" && discipline
      ? thresholdPoints(discipline.name, sex, read, divisor)
      : null;
  const problem =
    draft.thresholdOn && discipline && (draft.checked || typeof read === "string")
      ? draft.thresholdText.trim() === ""
        ? draft.checked
          ? messages.errors.MARK_INVALID
          : null
        : typeof read === "string"
          ? read
          : null
      : null;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="break-words font-display text-lg font-extrabold">{name}</p>
        {records && <p className="font-mono text-sm text-muted-foreground">{records}</p>}
      </div>

      {discipline && (
        <section aria-labelledby={`${id}-discipline`} className="flex flex-col gap-2">
          <h3
            id={`${id}-discipline`}
            className="text-xs font-bold uppercase tracking-wide text-muted-foreground"
          >
            {text.discipline}
          </h3>
          {disciplines.length > 1 && (
            <div
              role="radiogroup"
              aria-labelledby={`${id}-discipline`}
              className="flex flex-wrap gap-1 rounded-full bg-muted p-1"
            >
              {disciplines.map((d) => {
                const active = d.name === discipline.name;
                return (
                  <button
                    key={d.name}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() =>
                      onChange({
                        ...draft,
                        discipline: d.name,
                        // A mark of another discipline means nothing here.
                        thresholdText: d.name === discipline.name ? draft.thresholdText : "",
                        checked: false,
                      })
                    }
                    className={cn(
                      "min-h-11 flex-1 rounded-full px-3 text-sm font-bold",
                      "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring",
                      active ? "bg-primary text-primary-foreground shadow" : "text-foreground",
                    )}
                  >
                    {d.name}
                  </button>
                );
              })}
            </div>
          )}
          <p className="text-sm">{text.onlyDiscipline(discipline.name)}</p>
        </section>
      )}

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
          {text.substitute(familyLabel)}
        </legend>
        {substitutes.length === 0 && (
          <p className="rounded-card bg-muted p-3 text-sm">{text.noCandidate}</p>
        )}
        {substitutes.map((s) => (
          <label
            key={s.athleteId}
            className={cn(
              "flex min-h-14 items-center gap-3 rounded-2xl border border-border px-3 py-2",
              draft.substituteId === s.athleteId && "border-2 border-primary",
              s.disabled && "opacity-60",
            )}
          >
            <input
              type="radio"
              name={`${id}-substitute`}
              checked={draft.substituteId === s.athleteId}
              disabled={s.disabled}
              onChange={() => onChange({ ...draft, substituteId: s.athleteId })}
              className="size-5 shrink-0 accent-primary"
            />
            <span className="min-w-0 flex-1">
              <span className="block break-words font-bold">
                {s.name} · {s.discipline}
              </span>
              <span className="block text-xs font-semibold text-muted-foreground">{s.note}</span>
            </span>
          </label>
        ))}
        <label
          className={cn(
            "flex min-h-14 items-center gap-3 rounded-2xl border border-border px-3 py-2",
            draft.substituteId === null && "border-2 border-primary",
          )}
        >
          <input
            type="radio"
            name={`${id}-substitute`}
            checked={draft.substituteId === null}
            onChange={() =>
              onChange({ ...draft, substituteId: null, thresholdOn: false, checked: false })
            }
            className="size-5 shrink-0 accent-primary"
          />
          <span className="min-w-0 flex-1">
            <span className="block font-bold">{text.noSubstitute}</span>
            <span className="block text-xs font-semibold text-muted-foreground">
              {text.noSubstituteHint}
            </span>
          </span>
        </label>
      </fieldset>

      {discipline && (
        <section aria-labelledby={`${id}-tactical`} className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-3">
            <h3
              id={`${id}-tactical`}
              className="text-xs font-bold uppercase tracking-wide text-muted-foreground"
            >
              {text.tactical} <span className="font-normal normal-case">({text.optional})</span>
            </h3>
            <button
              type="button"
              role="switch"
              aria-checked={draft.thresholdOn}
              aria-label={text.tacticalToggle}
              disabled={!substitute}
              onClick={() =>
                onChange({ ...draft, thresholdOn: !draft.thresholdOn, checked: false })
              }
              className={cn(
                "relative inline-flex h-8 w-14 shrink-0 items-center rounded-full p-1 transition-colors motion-reduce:transition-none",
                "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring disabled:opacity-50",
                draft.thresholdOn ? "bg-primary" : "bg-muted-foreground/40",
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "size-6 rounded-full bg-background shadow transition-transform motion-reduce:transition-none",
                  draft.thresholdOn && "translate-x-6",
                )}
              />
            </button>
          </div>
          {!substitute ? (
            <p className="text-sm text-muted-foreground">{text.tacticalNeedsSubstitute}</p>
          ) : (
            draft.thresholdOn && (
              <div className="flex flex-col gap-2 rounded-2xl bg-muted p-3">
                <label htmlFor={`${id}-threshold`} className="text-sm font-semibold">
                  {text.tacticalRule(substitute.name, name, sense)}
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    id={`${id}-threshold`}
                    type="text"
                    inputMode={markInputMode(discipline.unit, discipline.family)}
                    maxLength={MARK_MAX_LENGTH}
                    autoComplete="off"
                    aria-invalid={problem ? true : undefined}
                    aria-describedby={problem ? `${id}-threshold-error` : undefined}
                    value={draft.thresholdText}
                    onChange={(event) => onChange({ ...draft, thresholdText: event.target.value })}
                    className="min-h-11 w-28 rounded-xl border border-border bg-background px-3 font-mono tabular-nums"
                  />
                  {points !== null && (
                    <span className="font-mono text-sm font-bold tabular-nums">
                      {text.thresholdPoints(points)}
                    </span>
                  )}
                </div>
                {problem && (
                  <p
                    id={`${id}-threshold-error`}
                    role="alert"
                    className="text-sm font-semibold text-accent-text"
                  >
                    {problem}
                  </p>
                )}
                <p className="text-sm">{text.tacticalNote(substitute.name, sense)}</p>
              </div>
            )
          )}
        </section>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onBack}
          className={cn(buttonVariants({ variant: "outline" }), "flex-1")}
        >
          {text.back}
        </button>
        <button type="button" onClick={onSave} className={cn(buttonVariants(), "flex-1")}>
          {text.save}
        </button>
      </div>
    </div>
  );
}
