"use client";

import { useActionState } from "react";

import { messages } from "@/app/messages.fr";
import { SubmitButton } from "@/components/account/submit-button";

import { promoteAction, type AdminActionState } from "./actions";

/** Qualifies the first of a heat or semi-final for the round it leads to. */
export function PromoteForm({ eventId, slug }: { eventId: string; slug: string }) {
  const [state, action] = useActionState<AdminActionState & { done?: boolean }, FormData>(
    promoteAction,
    {},
  );
  return (
    <form
      action={action}
      className="flex flex-col gap-2 rounded-card border border-border bg-card p-3.5"
    >
      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="slug" value={slug} />
      <h2 className="font-bold">{messages.rounds.promote}</h2>
      <label className="flex items-center justify-between gap-3 text-sm font-semibold">
        {messages.rounds.promoteTop}
        <input
          type="number"
          name="top"
          min={1}
          max={24}
          defaultValue={2}
          className="min-h-11 w-20 rounded-xl border-2 border-border bg-background px-2.5 text-base"
        />
      </label>
      {state.error && (
        <p role="alert" className="text-sm font-semibold text-accent-text">
          {messages.errors[state.error]}
        </p>
      )}
      {state.done && (
        <p role="status" className="text-sm font-semibold text-success-text">
          {messages.rounds.promoted}
        </p>
      )}
      <SubmitButton pendingLabel={messages.startList.saving}>
        {messages.rounds.promote}
      </SubmitButton>
    </form>
  );
}
