"use client";

import { useActionState, useState } from "react";

import { messages } from "@/app/messages.fr";
import { SubmitButton } from "@/components/account/submit-button";
import { buttonVariants } from "@/components/ui/button";

import { finishRoundAction, type BidFormState } from "./bid-actions";

const text = messages.catalogue;

/**
 * « J'ai fini ce tour » (#1084): after a confirmation, the player bids no more in this round; the
 * round closes as soon as every participant has finished it.
 */
export function FinishRoundForm({ leagueId }: { leagueId: string }) {
  const [state, action] = useActionState<BidFormState, FormData>(finishRoundAction, {});
  const [confirming, setConfirming] = useState(false);
  return (
    <form action={action} className="flex flex-col gap-2 border-t border-border pt-3">
      <input type="hidden" name="league" value={leagueId} />
      {confirming ? (
        <>
          <p className="text-sm font-semibold">{text.finishConfirm}</p>
          <div className="flex gap-2">
            <SubmitButton pendingLabel={text.finishing} className="flex-1">
              {text.finishYes}
            </SubmitButton>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className={`${buttonVariants({ variant: "muted" })} flex-1`}
            >
              {text.cancel}
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">{text.finishRoundHint}</p>
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className={`${buttonVariants({ variant: "muted" })} w-full`}
          >
            {text.finishRound}
          </button>
        </>
      )}
      {state.error && (
        <p role="alert" className="text-sm font-semibold text-accent-text">
          {messages.errors[state.error]}
        </p>
      )}
    </form>
  );
}
