"use client";

import { useActionState } from "react";

import { messages } from "@/app/messages.fr";
import { SubmitButton } from "@/components/account/submit-button";

import { managerBidAction, type BidFormState } from "./bid-actions";

const text = messages.catalogue;

/** The player's secret bid on one athlete of the catalogue: place it, change it, withdraw it. */
export function BidForm({
  leagueId,
  athleteId,
  name,
  price,
  current,
}: {
  leagueId: string;
  athleteId: string;
  name: string;
  price: number;
  current: number | null;
}) {
  const [state, action] = useActionState<BidFormState, FormData>(managerBidAction, {});
  return (
    <form action={action} className="flex flex-col gap-2 border-t border-border pt-3">
      <input type="hidden" name="league" value={leagueId} />
      <input type="hidden" name="athlete" value={athleteId} />
      {current !== null && <p className="text-sm font-bold text-primary">{text.myBid(current)}</p>}
      <div className="flex items-center gap-2">
        <input
          type="number"
          name="amount"
          aria-label={text.bidLabel(name)}
          defaultValue={current ?? price}
          min={price}
          step={1}
          inputMode="numeric"
          required
          className="min-h-11 w-24 shrink-0 rounded-xl border-2 border-border bg-card px-2.5 text-right font-mono text-base font-bold tabular-nums"
        />
        <span className="text-sm font-semibold text-muted-foreground">{text.credits}</span>
      </div>
      <div className={`grid gap-2 ${current !== null ? "grid-cols-2" : "grid-cols-1"}`}>
        <SubmitButton pendingLabel={text.bidding} intent="bid">
          {current !== null ? text.change : text.bid}
        </SubmitButton>
        {current !== null && (
          <SubmitButton pendingLabel={text.bidding} intent="withdraw" variant="muted" noValidate>
            {text.withdraw}
          </SubmitButton>
        )}
      </div>
      {state.error && (
        <p role="alert" className="text-sm font-semibold text-accent-text">
          {messages.errors[state.error]}
        </p>
      )}
    </form>
  );
}
