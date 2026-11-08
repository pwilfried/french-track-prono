"use client";

import { useActionState } from "react";

import { messages } from "@/app/messages.fr";
import { SubmitButton } from "@/components/account/submit-button";
import type { MarkUnit } from "@/domain/discipline";

import { saveToleranceAction, type ToleranceState } from "./actions";

/** One discipline's tolerance, edited in place. */
export function ToleranceForm({
  name,
  unit,
  tolerance,
}: {
  name: string;
  unit: MarkUnit;
  tolerance: number;
}) {
  const [state, action] = useActionState<ToleranceState, FormData>(saveToleranceAction, {});
  return (
    <form action={action} className="flex flex-col gap-1">
      <input type="hidden" name="name" value={name} />
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">±</span>
        <input
          name="tolerance"
          aria-label={messages.disciplines.tolerance(name)}
          defaultValue={String(tolerance)}
          inputMode="decimal"
          className="min-h-11 w-20 rounded-xl border-2 border-border bg-background px-2.5 font-mono text-base"
        />
        <span className="w-6 text-sm text-muted-foreground">{messages.disciplines.unit[unit]}</span>
        <SubmitButton pendingLabel={messages.disciplines.saving} variant="muted">
          {messages.disciplines.save}
        </SubmitButton>
      </div>
      {state.error && (
        <p role="alert" className="text-sm font-semibold text-accent-text">
          {messages.errors[state.error]}
        </p>
      )}
      {state.saved && (
        <p role="status" className="text-sm font-semibold text-success-text">
          {messages.disciplines.saved}
        </p>
      )}
    </form>
  );
}
