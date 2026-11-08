"use client";

import { useActionState } from "react";

import { messages } from "@/app/messages.fr";
import { SubmitButton } from "@/components/account/submit-button";

import { computePointsAction, type AdminActionState } from "./actions";

/** "Confirmer le calcul" (or "Recalculer"), with the French message of a refused computation. */
export function ComputeForm({
  eventId,
  slug,
  again,
}: {
  eventId: string;
  slug: string;
  again: boolean;
}) {
  const [state, action] = useActionState<AdminActionState, FormData>(computePointsAction, {});
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="slug" value={slug} />
      {state.error && (
        <p role="alert" className="text-sm font-semibold text-accent-text">
          {messages.errors[state.error]}
        </p>
      )}
      <SubmitButton pendingLabel={messages.admin.computing} variant={again ? "muted" : "default"}>
        {again ? messages.admin.recompute : messages.admin.compute}
      </SubmitButton>
    </form>
  );
}
