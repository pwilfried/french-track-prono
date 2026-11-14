"use client";

import { useActionState, useState } from "react";

import { messages } from "@/app/messages.fr";
import { SubmitButton } from "@/components/account/submit-button";
import { buttonVariants } from "@/components/ui/button";
import { ChipStatus } from "@/components/ui/chip-status";
import { MAX_BID_DIGITS } from "@/domain/manager-bid";

import { managerBidAction, type BidFormState } from "./bid-actions";

const text = messages.catalogue;
const step =
  "grid size-11 shrink-0 place-items-center rounded-xl border-2 border-border text-lg font-bold";

/**
 * The player's secret bid on one athlete of the catalogue (#422), folded behind « Enchérir » or
 * « Modifier » so the catalogue stays compact (#503): − / amount / +, then confirm or withdraw.
 */
export function BidForm({
  leagueId,
  athleteId,
  name,
  price,
  current,
  credits,
}: {
  leagueId: string;
  athleteId: string;
  name: string;
  price: number;
  current: number | null;
  /** The most this bid can be: the credits left, with those of the current bid on the athlete. */
  credits: number;
}) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(String(current ?? price));
  const [state, action] = useActionState<BidFormState, FormData>(async (previous, data) => {
    const result = await managerBidAction(previous, data);
    if (!result.error) setOpen(false);
    return result;
  }, {});
  // Never under the price; never over the credits, unless they are short of the price anyway
  // (the server then says why).
  const max = Math.max(price, Math.min(credits, 10 ** MAX_BID_DIGITS - 1));
  const nudge = (by: number) =>
    setAmount(String(Math.min(max, Math.max(price, (Number(amount) || price) + by))));

  if (!open) {
    return (
      <div className="flex flex-col gap-2">
        {current !== null && (
          <ChipStatus tone="brand" className="justify-center">
            {text.myBid(current)}
          </ChipStatus>
        )}
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={`${buttonVariants({ variant: current !== null ? "outline" : "default" })} w-full px-3 text-sm`}
        >
          {current !== null ? text.change : text.bid}
        </button>
      </div>
    );
  }

  return (
    <form action={action} noValidate className="flex flex-col gap-2 border-t border-border pt-3">
      <input type="hidden" name="league" value={leagueId} />
      <input type="hidden" name="athlete" value={athleteId} />
      <div className="flex items-center gap-2">
        <button type="button" aria-label={text.less} onClick={() => nudge(-1)} className={step}>
          −
        </button>
        <input
          type="number"
          name="amount"
          aria-label={text.bidLabel(name)}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          min={price}
          max={max}
          step={1}
          inputMode="numeric"
          required
          className="min-h-11 w-16 shrink-0 rounded-xl border-2 border-border bg-card px-1 text-center font-mono text-base font-bold tabular-nums"
        />
        <button type="button" aria-label={text.more} onClick={() => nudge(1)} className={step}>
          +
        </button>
        <SubmitButton pendingLabel={text.bidding} intent="bid">
          {text.confirm}
        </SubmitButton>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {current !== null ? (
          <SubmitButton pendingLabel={text.bidding} intent="withdraw" variant="muted" noValidate>
            {text.withdraw}
          </SubmitButton>
        ) : (
          <span />
        )}
        <button
          type="button"
          onClick={() => setOpen(false)}
          className={`${buttonVariants({ variant: "outline" })} text-sm`}
        >
          {text.cancel}
        </button>
      </div>
      {state.error && (
        <p role="alert" className="text-sm font-semibold text-accent-text">
          {messages.errors[state.error]}
        </p>
      )}
    </form>
  );
}
