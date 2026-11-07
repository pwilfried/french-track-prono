"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { messages } from "@/app/messages.fr";
import { reactAction, type ReactState } from "@/app/epreuves/[slug]/react-action";
import { REACTIONS, type Reaction } from "@/domain/reveal";

function ReactionButton({
  reaction,
  count,
  pressed,
}: {
  reaction: Reaction;
  count: number;
  pressed: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      name="reaction"
      value={reaction}
      disabled={pending}
      aria-pressed={pressed}
      aria-label={messages.reactions.label(messages.reactions.names[reaction], count)}
      className={`flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-2xl border bg-background px-1 text-lg disabled:opacity-60 ${
        pressed ? "border-2 border-ring bg-muted" : "border-border"
      }`}
    >
      <span aria-hidden="true">{reaction}</span>
      {count > 0 && (
        <span aria-hidden="true" className="text-sm font-bold tabular-nums">
          {count}
        </span>
      )}
    </button>
  );
}

/** The six emoji under someone else's revealed podium: tap to react, tap mine again to remove it. */
export function ReactionBar({
  slug,
  predictionId,
  counts,
  mine,
}: {
  slug: string;
  predictionId: string;
  counts: Partial<Record<Reaction, number>>;
  mine: Reaction | null;
}) {
  const [state, action] = useActionState<ReactState, FormData>(reactAction, {});
  return (
    <form action={action} className="flex flex-col gap-1">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="predictionId" value={predictionId} />
      <input type="hidden" name="current" value={mine ?? ""} />
      <div role="group" aria-label={messages.reactions.group} className="grid grid-cols-6 gap-1.5">
        {REACTIONS.map((reaction) => (
          <ReactionButton
            key={reaction}
            reaction={reaction}
            count={counts[reaction] ?? 0}
            pressed={mine === reaction}
          />
        ))}
      </div>
      {state.error && (
        <p role="alert" className="text-sm font-semibold text-accent-text">
          {messages.errors[state.error]}
        </p>
      )}
    </form>
  );
}

/** On my own podium: only what the others said. */
export function ReactionSummary({ counts }: { counts: { reaction: Reaction; count: number }[] }) {
  if (counts.length === 0) return null;
  return (
    <p className="text-sm text-muted-foreground">
      {counts.map(({ reaction, count }) => `${reaction} ${count}`).join(" · ")}
    </p>
  );
}
