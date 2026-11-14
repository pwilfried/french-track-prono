"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import { SubmitButton } from "@/components/account/submit-button";
import { buttonVariants } from "@/components/ui/button";
import { PodiumPicker, type PickerAthlete } from "@/components/podium/podium-picker";
import type { MarkUnit } from "@/domain/discipline";
import { isComplete, OTHER_ATHLETE, type PodiumDraft } from "@/domain/podium-draft";

import { messages } from "../../messages.fr";
import { FirstPredictionTips } from "./first-prediction-tips";
import { savePredictionAction, type MarkTexts, type PredictionState } from "./actions";
import { forgetPodium, keepPodium, readKeptPodium } from "./kept-podium";

/** The podium of a signed-in player on an open event: compose, joker, save. */
export function PredictionForm({
  eventId,
  slug,
  athletes,
  initial,
  markUnit,
  tolerance,
}: {
  eventId: string;
  slug: string;
  athletes: PickerAthlete[];
  initial: PredictionState;
  /** Known for the discipline: the player may then predict a mark per athlete. */
  markUnit?: MarkUnit;
  tolerance?: number;
}) {
  const [state, action] = useActionState(savePredictionAction, initial);
  const [draft, setDraft] = useState(initial.draft);
  const [joker, setJoker] = useState(initial.useJoker);
  // Bumped when a podium kept in the tab is restored: the picker starts again from it.
  const [restored, setRestored] = useState(0);
  const podiumRef = useRef<HTMLDivElement>(null);
  const keep = (next: { draft?: PodiumDraft; joker?: boolean; openedAthlete?: boolean }) =>
    keepPodium(eventId, { draft, joker, openedAthlete: false, ...next });

  // Back from an athlete's page (#699): the podium being built is still there, in view.
  useEffect(() => {
    const kept = readKeptPodium(
      eventId,
      athletes.map((a) => a.athleteId),
    );
    if (!kept) return;
    // Read once the page is on screen: the server cannot see this tab's storage.
    /* eslint-disable react-hooks/set-state-in-effect */
    setDraft(kept.draft);
    setJoker(kept.joker);
    setRestored((n) => n + 1);
    /* eslint-enable react-hooks/set-state-in-effect */
    if (kept.openedAthlete) {
      keepPodium(eventId, { ...kept, openedAthlete: false });
      requestAnimationFrame(() => podiumRef.current?.scrollIntoView({ block: "start" }));
    }
    // Only when the page opens: later changes come from the player.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (state.saved || state.error === "PREDICTION_LOCKED") forgetPodium(eventId);
  }, [state, eventId]);
  const complete = isComplete(draft);
  // Locked while saving: the podium is shown read only from then on.
  const locked = state.error === "PREDICTION_LOCKED";
  // Offline, the save would fail without a word: say it, keep the podium as composed.
  const [offline, setOffline] = useState(false);
  const error = offline
    ? messages.offline.prediction
    : state.error
      ? messages.errors[state.error]
      : undefined;
  const submit = (data: FormData) => {
    const isOffline = !navigator.onLine;
    setOffline(isOffline);
    if (!isOffline) action(data);
  };

  return (
    <form action={submit} className="flex flex-col gap-4">
      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="slug" value={slug} />
      {markUnit && <input type="hidden" name="markUnit" value={markUnit} />}
      {/* Once a podium is saved the tips only push it down (#493). */}
      {!isComplete(initial.draft) && <FirstPredictionTips />}
      {state.saved && (
        <p
          role="status"
          className="mx-4 rounded-2xl bg-success/15 px-3.5 py-3 text-sm font-semibold text-success-text"
        >
          {messages.prediction.saved}
        </p>
      )}
      <div ref={podiumRef} id="podium" className="scroll-mt-4">
        <PodiumPicker
          key={restored}
          athletes={athletes}
          initialDraft={draft}
          error={error}
          disabled={locked}
          onChange={(next: PodiumDraft) => {
            setDraft(next);
            keep({ draft: next });
          }}
          helpHref="/regles"
          athleteHref={(athlete) =>
            `/athletes/${athlete.slug}?from=${encodeURIComponent(`/epreuves/${slug}`)}`
          }
          onOpenAthlete={() => keep({ openedAthlete: true })}
        />
      </div>
      {markUnit && !locked && (
        <MarkFields
          draft={draft}
          athletes={athletes}
          unit={markUnit}
          tolerance={tolerance}
          initial={state.marks}
        />
      )}
      {!locked && (
        <>
          <label className="mx-4 flex min-h-16 cursor-pointer items-center gap-3 rounded-2xl border-2 border-transparent bg-gold-soft px-3.5 py-2 text-gold-ink has-checked:border-secondary">
            <span className="min-w-0 flex-1">
              <span className="block font-extrabold">{messages.prediction.joker}</span>
              <span className="block text-sm text-muted-foreground">
                {messages.prediction.jokerHint}
              </span>
            </span>
            <input
              type="checkbox"
              role="switch"
              name="joker"
              checked={joker}
              onChange={(e) => {
                setJoker(e.target.checked);
                keep({ joker: e.target.checked });
              }}
              className="peer sr-only"
            />
            <span
              aria-hidden
              className="relative h-7 w-12 shrink-0 rounded-full bg-border transition-colors peer-checked:bg-primary peer-focus-visible:ring-4 peer-focus-visible:ring-ring after:absolute after:top-1 after:left-1 after:size-5 after:rounded-full after:bg-white after:transition-transform peer-checked:after:translate-x-5 motion-reduce:transition-none motion-reduce:after:transition-none"
            />
          </label>
          <div className="px-4">
            {complete ? (
              <SubmitButton pendingLabel={messages.prediction.saving}>
                {messages.prediction.save}
              </SubmitButton>
            ) : (
              <button type="button" disabled className={`${buttonVariants()} w-full`}>
                {messages.prediction.save}
              </button>
            )}
          </div>
        </>
      )}
    </form>
  );
}

const SLOTS = [
  ["first", "m1"],
  ["second", "m2"],
  ["third", "m3"],
] as const;

/** One optional mark per athlete placed on the podium (none for « autre athlète »). */
function MarkFields({
  draft,
  athletes,
  unit,
  tolerance,
  initial,
}: {
  draft: PodiumDraft;
  athletes: PickerAthlete[];
  unit: MarkUnit;
  tolerance?: number;
  initial: MarkTexts;
}) {
  const placed = SLOTS.flatMap(([slot, name]) => {
    const athlete = athletes.find((a) => a.athleteId === draft[slot]);
    return athlete && athlete.athleteId !== OTHER_ATHLETE ? [{ slot, name, athlete }] : [];
  });
  if (placed.length === 0) return null;
  return (
    <fieldset className="mx-4 flex flex-col gap-3 rounded-2xl border border-border p-3.5">
      <legend className="px-1 text-xs font-bold tracking-wider text-muted-foreground uppercase">
        {messages.picker.marksTitle}
      </legend>
      {tolerance !== undefined && (
        <p className="text-sm text-muted-foreground">
          {messages.picker.marksHint(messages.picker.tolerance(tolerance, unit))}
        </p>
      )}
      {placed.map(({ slot, name, athlete }) => (
        <label key={slot} className="flex items-center gap-3">
          <span className="min-w-0 flex-1 text-sm font-semibold">
            {messages.picker.markLabel(athlete.name)}
          </span>
          <input
            key={athlete.athleteId}
            name={name}
            inputMode="decimal"
            autoComplete="off"
            defaultValue={initial[slot]}
            placeholder={messages.picker.markPlaceholder[unit]}
            className="min-h-11 w-28 rounded-xl border-2 border-border bg-background px-3 text-right font-mono font-bold"
          />
        </label>
      ))}
    </fieldset>
  );
}
