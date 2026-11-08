"use client";

import { useActionState } from "react";

import { messages } from "@/app/messages.fr";
import { SubmitButton } from "@/components/account/submit-button";

import { deleteLeagueAction, renameLeagueAction, type ModerationState } from "./actions";

const text = messages.moderation;

function Outcome({ state }: { state: ModerationState }) {
  if (state.error) {
    return (
      <p role="alert" className="text-sm font-semibold text-accent-text">
        {messages.errors[state.error]}
      </p>
    );
  }
  return state.done ? (
    <p role="status" className="text-sm font-semibold text-success-text">
      {text.done}
    </p>
  ) : null;
}

/** Renames a reported league; its reports are then cleared. */
export function RenameLeagueForm({ leagueId, name }: { leagueId: string; name: string }) {
  const [state, action] = useActionState<ModerationState, FormData>(renameLeagueAction, {});
  return (
    <form action={action} className="flex flex-col gap-1.5">
      <input type="hidden" name="leagueId" value={leagueId} />
      <input
        name="name"
        aria-label={text.renameLabel(name)}
        defaultValue={name}
        maxLength={40}
        className="min-h-11 rounded-xl border-2 border-border bg-background px-2.5 text-base"
      />
      <SubmitButton pendingLabel={text.renaming} variant="muted">
        {text.rename}
      </SubmitButton>
      <Outcome state={state} />
    </form>
  );
}

/** Deletes a league with its members, once the admin ticked the confirmation. */
export function DeleteLeagueForm({ leagueId }: { leagueId: string }) {
  const [state, action] = useActionState<ModerationState, FormData>(deleteLeagueAction, {});
  return (
    <form action={action} className="flex flex-col gap-1.5">
      <input type="hidden" name="leagueId" value={leagueId} />
      <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm">
        <input type="checkbox" name="confirm" value="1" className="size-5 accent-primary" />
        {text.removeConfirm}
      </label>
      <SubmitButton pendingLabel={text.removing} variant="muted">
        {text.remove}
      </SubmitButton>
      <Outcome state={state} />
    </form>
  );
}
