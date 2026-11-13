"use client";

import { useActionState } from "react";

import { messages } from "@/app/messages.fr";
import { SubmitButton } from "@/components/account/submit-button";

import { computePointsAction, type AdminActionState } from "./actions";

/**
 * « Recalculer », the fallback of the results sheet (#665): the same computation as saving the
 * sheet, with the French message of a refused computation.
 */
export function ComputeForm({ slug }: { slug: string }) {
  const [state, action] = useActionState<AdminActionState, FormData>(computePointsAction, {});
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="slug" value={slug} />
      {state.error && (
        <p role="alert" className="text-sm font-semibold text-accent-text">
          {messages.errors[state.error]}
        </p>
      )}
      <SubmitButton pendingLabel={messages.admin.computing} variant="muted">
        {messages.admin.recompute}
      </SubmitButton>
    </form>
  );
}
