"use client";

import { useActionState, useState } from "react";

import { SubmitButton } from "@/components/account/submit-button";
import { buttonVariants } from "@/components/ui/button";
import { PodiumPicker } from "@/components/podium/podium-picker";
import type { Entry } from "@/domain/event";
import { isComplete, type PodiumDraft } from "@/domain/podium-draft";

import { messages } from "../../messages.fr";
import { savePredictionAction, type PredictionState } from "./actions";

/** The podium of a signed-in player on an open event: compose, joker, save. */
export function PredictionForm({
  eventId,
  slug,
  athletes,
  initial,
}: {
  eventId: string;
  slug: string;
  athletes: Entry[];
  initial: PredictionState;
}) {
  const [state, action] = useActionState(savePredictionAction, initial);
  const [complete, setComplete] = useState(isComplete(initial.draft));
  // Locked while saving: the podium is shown read only from then on.
  const locked = state.error === "PREDICTION_LOCKED";
  const error = state.error ? messages.errors[state.error] : undefined;

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="slug" value={slug} />
      {state.saved && (
        <p
          role="status"
          className="mx-4 rounded-2xl bg-success/15 px-3.5 py-3 text-sm font-semibold text-success-text"
        >
          {messages.prediction.saved}
        </p>
      )}
      <PodiumPicker
        athletes={athletes}
        initialDraft={state.draft}
        error={error}
        disabled={locked}
        onChange={(draft: PodiumDraft) => setComplete(isComplete(draft))}
      />
      {!locked && (
        <>
          <label className="mx-4 flex min-h-16 cursor-pointer items-center gap-3 rounded-2xl border-2 border-border bg-card px-3.5 py-2 has-checked:border-secondary has-checked:bg-secondary/20">
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
              defaultChecked={state.useJoker}
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
