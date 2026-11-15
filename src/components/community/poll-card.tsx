"use client";

import { useActionState } from "react";

import type { ErrorCode } from "@/application/errors";
import { messages } from "@/app/messages.fr";
import { SubmitButton } from "@/components/account/submit-button";
import { ChipStatus } from "@/components/ui/chip-status";
import { pollPhase, pollResults, type Poll } from "@/domain/community";
import { cn } from "@/lib/utils";

const text = messages.community.poll;

/** What the vote sends back: the poll as it is now (with its results), or why it was refused. */
export type VoteState = { poll?: Poll; error?: ErrorCode };
export type VoteAction = (state: VoteState, data: FormData) => Promise<VoteState>;

/**
 * A poll of the admin (#673): a question and 2 to 4 answers. Before the vote, one tap on an
 * answer votes; after it, or once the poll is closed, the share of each answer, the player's own
 * marked. The results are never shown before the player takes part.
 */
export function PollCard({ poll, now, vote }: { poll: Poll; now: Date; vote: VoteAction }) {
  const [state, action] = useActionState<VoteState, FormData>(vote, {});
  const shown = state.poll ?? poll;
  const phase = pollPhase(shown, now);
  const titleId = `poll-${shown.id}`;

  return (
    <article
      aria-labelledby={titleId}
      className="flex flex-col gap-3 rounded-2xl border border-border bg-card px-3.5 py-3"
    >
      <div className="flex flex-wrap items-center gap-2">
        <ChipStatus tone="gold">{text.label}</ChipStatus>
        <span className="text-xs text-muted-foreground">
          {phase === "closed" ? text.closed : text.closesAt(shown.closesAt)}
        </span>
      </div>
      <h3 id={titleId} className="font-bold leading-tight break-words">
        {shown.question}
      </h3>
      {phase === "open" ? (
        <form action={action} className="flex flex-col gap-2">
          <input type="hidden" name="poll" value={shown.id} />
          <p className="text-xs text-muted-foreground">{text.choose}</p>
          {shown.options.map((option, i) => (
            <SubmitButton
              key={option}
              intent={String(i)}
              pendingLabel={text.voting}
              variant="outline"
              className="h-auto min-h-11 w-full justify-start whitespace-normal py-2 text-left break-words"
            >
              {option}
            </SubmitButton>
          ))}
        </form>
      ) : (
        <Results poll={shown} />
      )}
      {state.error && (
        <p role="alert" className="text-sm font-semibold text-accent-text">
          {messages.errors[state.error]}
        </p>
      )}
      {state.poll && phase !== "open" && (
        <p role="status" className="text-sm font-semibold text-success-text">
          {text.voted}
        </p>
      )}
    </article>
  );
}

function Results({ poll }: { poll: Poll }) {
  const { total, answers } = pollResults(poll.votes ?? poll.options.map(() => 0));
  return (
    <div className="flex flex-col gap-2">
      <ul className="flex flex-col gap-2">
        {poll.options.map((option, i) => {
          const mine = poll.myChoice === i;
          const { percent } = answers[i];
          return (
            <li
              key={option}
              aria-label={text.result(option, percent, mine)}
              className={cn(
                "relative overflow-hidden rounded-xl border px-3 py-2",
                mine ? "border-2 border-gold-ink font-bold" : "border-border",
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "absolute inset-y-0 left-0 motion-safe:transition-[width] motion-safe:duration-300",
                  mine ? "bg-gold-soft" : "bg-foreground/10",
                )}
                style={{ width: `${percent}%` }}
              />
              <span className="relative flex items-center justify-between gap-3">
                <span className="min-w-0 break-words">
                  {option}
                  {mine && (
                    <span className="ml-2 text-xs font-bold text-gold-ink">{text.myVote}</span>
                  )}
                </span>
                <span className="shrink-0 font-mono text-sm tabular-nums">
                  {text.percent(percent)}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
      <p className="font-mono text-xs tabular-nums text-muted-foreground">{text.votes(total)}</p>
    </div>
  );
}
