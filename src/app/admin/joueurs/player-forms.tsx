"use client";

import { useActionState } from "react";

import { messages } from "@/app/messages.fr";
import { SubmitButton } from "@/components/account/submit-button";

import { deletePlayerAction, setBlockedAction, type PlayerActionState } from "./actions";

const text = messages.adminPlayers;

function Outcome({ state }: { state: PlayerActionState }) {
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

/** Blocks or unblocks a player. */
export function BlockForm({ playerId, blocked }: { playerId: string; blocked: boolean }) {
  const [state, action] = useActionState<PlayerActionState, FormData>(setBlockedAction, {});
  return (
    <form action={action} className="flex flex-col gap-1.5">
      <input type="hidden" name="playerId" value={playerId} />
      <input type="hidden" name="blocked" value={blocked ? "0" : "1"} />
      <SubmitButton pendingLabel={text.pending} variant="muted">
        {blocked ? text.unblock : text.block}
      </SubmitButton>
      <Outcome state={state} />
    </form>
  );
}

/** Deletes a player's account, once the admin ticked the confirmation. */
export function DeletePlayerForm({ playerId, pseudo }: { playerId: string; pseudo: string }) {
  const [state, action] = useActionState<PlayerActionState, FormData>(deletePlayerAction, {});
  return (
    <form action={action} className="flex flex-col gap-1.5">
      <input type="hidden" name="playerId" value={playerId} />
      <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="confirm"
          value="1"
          className="size-5 shrink-0 accent-primary"
        />
        {text.removeConfirm(pseudo)}
      </label>
      <SubmitButton pendingLabel={text.removing} variant="muted">
        {text.remove}
      </SubmitButton>
      <Outcome state={state} />
    </form>
  );
}
