"use client";

import { useActionState } from "react";

import { buttonVariants } from "@/components/ui/button";

import { messages } from "../messages.fr";
import { toggleProgramAlertAction } from "./program-alert-actions";

const text = messages.competitions.pending;

/** « Me prévenir à la publication », then « Tu seras prévenu », which undoes it (#659). */
export function ProgramAlertButton({ competition, on }: { competition: string; on: boolean }) {
  const [state, action, pending] = useActionState(toggleProgramAlertAction, { on, error: false });
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="competition" value={competition} />
      <button
        type="submit"
        disabled={pending}
        aria-pressed={state.on}
        className={buttonVariants({ variant: state.on ? "muted" : "default" })}
      >
        {state.on ? `✓ ${text.notified}` : text.notify}
      </button>
      <p className="text-xs text-muted-foreground">
        {state.on ? text.notifiedHint : text.deviceHint}
      </p>
      {state.error && (
        <p role="alert" className="text-sm font-semibold text-primary-ink">
          {text.error}
        </p>
      )}
    </form>
  );
}
