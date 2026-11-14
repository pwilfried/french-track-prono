"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";

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

import { BottomSheet } from "../ui/bottom-sheet";

const MEDAL_STYLE = {
  1: "bg-gradient-to-b from-(--medal-gold-from) to-(--medal-gold-to) text-(--medal-gold-ink) border-transparent",
  2: "bg-gradient-to-b from-(--medal-silver-from) to-(--medal-silver-to) text-(--medal-silver-ink) border-transparent",
  3: "bg-gradient-to-b from-(--medal-bronze-from) to-(--medal-bronze-to) text-(--medal-bronze-ink) border-transparent",
} as const;
const KEY = { 1: "first", 2: "second", 3: "third" } as const;
// Display order: second on the left, winner in the middle, third on the right.
const DISPLAY: Step[] = [2, 1, 3];
const STEP_HEIGHT = { 1: "min-h-32", 2: "min-h-28", 3: "min-h-24" } as const;
// The step being filled: a solid 3 px ring in the readable red (accent-text: ≥ 3:1 against the
// page and the card in both themes, WCAG 1.4.11), set off from the step so it shows on medals too.
const ACTIVE_STEP = "border-solid ring-3 ring-accent-text ring-offset-2 ring-offset-background";
// Keyboard focus: an outline in the ring colour (blue in light, gold in dark), never red, so it
// does not look like the selection.
const FOCUS = "focus-visible:outline-3 focus-visible:outline-ring";

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
  helpHref,
  help,
  athleteHref,
  draftKey,
}: {
  athletes: PickerAthlete[];
  initialDraft?: PodiumDraft;
  error?: string;
  disabled?: boolean;
  onChange?: (draft: PodiumDraft) => void;
  /** Heading above the steps ("Ton podium" by default). */
  title?: string;
  /** Where the « ? » button next to the heading leads (the rules). */
  helpHref?: string;
  /**
   * The rules to show over the page (#703): « Règles » then opens them in a sheet instead of
   * leaving, so the podium being built stays; `helpHref` remains the link without JavaScript.
   */
  help?: ReactNode;
  /** The page of an athlete (#336): each athlete then gets a « Fiche » link. */
  athleteHref?: (athlete: PickerAthlete) => string;
  /**
   * Keeps the podium being composed in this tab (sessionStorage), so that opening an athlete's
   * page and coming back does not lose it.
   */
  draftKey?: string;
}) {
  const [draft, setDraft] = useState(initialDraft);
  useEffect(() => {
    if (!draftKey || disabled) return;
    try {
      const kept = JSON.parse(sessionStorage.getItem(draftKey) ?? "null") as PodiumDraft | null;
      const known = (id: string | null) => id === null || athletes.some((a) => a.athleteId === id);
      if (kept && known(kept.first) && known(kept.second) && known(kept.third)) {
        // Read once the page is on screen: the server cannot see this tab's storage.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setDraft(kept);
        onChange?.(kept);
      }
    } catch {
      // No storage (private window): the podium starts from the saved one.
    }
    // Only when the page opens: later changes come from the player.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [helpOpen, setHelpOpen] = useState(false);
  const helpButton = useRef<HTMLAnchorElement>(null);
  const closeHelp = () => {
    setHelpOpen(false);
    helpButton.current?.focus();
  };
  const [selected, setSelected] = useState<Step | null>(null);
  const active = selected ?? nextEmptyStep(draft);
  const nameOf = (id: string | null) => athletes.find((a) => a.athleteId === id) ?? null;

  const update = (next: PodiumDraft) => {
    setDraft(next);
    setSelected(null);
    onChange?.(next);
    if (draftKey) {
      try {
        sessionStorage.setItem(draftKey, JSON.stringify(next));
      } catch {
        // No storage: the podium is only lost if the player leaves the page.
      }
    }
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
      <div className="flex items-center justify-between gap-2 px-4">
        <h2 className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
          {title}
        </h2>
        {helpHref && (
          <a
            ref={helpButton}
            href={helpHref}
            aria-label={messages.rules.helpLabel}
            aria-haspopup={help ? "dialog" : undefined}
            aria-expanded={help ? helpOpen : undefined}
            onClick={
              help
                ? (event) => {
                    event.preventDefault();
                    setHelpOpen(true);
                  }
                : undefined
            }
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-brand-soft px-4 text-sm font-extrabold text-brand-ink"
          >
            <span aria-hidden="true">?</span>
            {messages.rules.help}
          </a>
        )}
      </div>
      {helpHref && help && (
        <BottomSheet open={helpOpen} onClose={closeHelp} title={messages.rules.title}>
          <div className="flex flex-col gap-5 leading-relaxed">
            {help}
            <Link
              href={helpHref}
              className="inline-flex min-h-11 items-center self-start text-sm font-bold underline underline-offset-4"
            >
              {messages.rules.allRules}
            </Link>
          </div>
        </BottomSheet>
      )}
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
                FOCUS,
                "focus-visible:outline-offset-[7px]",
                STEP_HEIGHT[step],
                athlete
                  ? MEDAL_STYLE[step]
                  : "border-dashed border-border bg-card text-muted-foreground",
                active === step && !disabled && ACTIVE_STEP,
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
            <li key={athlete.athleteId} className="flex items-stretch gap-2">
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
                  "flex min-h-14 min-w-0 flex-1 items-center gap-3 rounded-2xl border-2 px-3.5 py-2 text-left",
                  FOCUS,
                  "focus-visible:outline-offset-2",
                  rank !== null
                    ? "border-accent-text bg-primary-soft"
                    : ["border-border", other ? "bg-brand-soft" : "bg-card"],
                  other && "text-brand-ink",
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
              {athleteHref && !other ? (
                <Link
                  href={athleteHref(athlete)}
                  aria-label={messages.picker.profileLabel(athlete.name)}
                  className="grid w-12 shrink-0 place-items-center rounded-2xl border border-border bg-card text-brand dark:text-secondary"
                >
                  <svg
                    aria-hidden
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  >
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 11v6" />
                    <path d="M12 7.5v.01" />
                  </svg>
                </Link>
              ) : null}
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
