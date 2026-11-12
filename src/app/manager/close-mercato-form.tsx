"use client";

import { useActionState } from "react";

import { messages } from "@/app/messages.fr";
import { SubmitButton } from "@/components/account/submit-button";

import { closeMercatoAction, type BidFormState } from "./bid-actions";

const text = messages.catalogue;

/** Shown to the last participant who can still recruit: they may end the mercato (#424). */
export function CloseMercatoForm({ leagueId }: { leagueId: string }) {
  const [state, action] = useActionState<BidFormState, FormData>(closeMercatoAction, {});
  return (
    <form action={action} className="flex flex-col gap-2 border-t border-border pt-3">
      <input type="hidden" name="league" value={leagueId} />
      <p className="text-sm">{text.lastBidder}</p>
      <SubmitButton pendingLabel={text.closing} variant="muted">
        {text.closeMercato}
      </SubmitButton>
      {state.error && (
        <p role="alert" className="text-sm font-semibold text-accent-text">
          {messages.errors[state.error]}
        </p>
      )}
    </form>
  );
}
