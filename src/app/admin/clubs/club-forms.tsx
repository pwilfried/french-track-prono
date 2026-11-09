"use client";

import { useActionState } from "react";

import { messages } from "@/app/messages.fr";
import { SubmitButton } from "@/components/account/submit-button";

import {
  deleteClubAction,
  saveClubAction,
  validateClubAction,
  type ClubActionState,
} from "./actions";

const text = messages.adminClubs;
const field =
  "min-h-11 rounded-xl border-2 border-border bg-background px-2.5 text-base focus-visible:border-primary focus-visible:outline-none";

function Outcome({ state }: { state: ClubActionState }) {
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

/** Creates a club (no id) or edits one. */
export function ClubForm({
  club,
}: {
  club?: { id: string; name: string; city: string; department: string };
}) {
  const [state, action] = useActionState<ClubActionState, FormData>(saveClubAction, {});
  const prefix = club ? `club-${club.id}` : "new-club";
  return (
    <form action={action} className="flex flex-col gap-2">
      {club ? <input type="hidden" name="id" value={club.id} /> : null}
      <label htmlFor={`${prefix}-name`} className="flex flex-col gap-1 text-sm font-bold">
        {text.nameLabel}
        <input
          id={`${prefix}-name`}
          name="name"
          defaultValue={club?.name}
          maxLength={120}
          className={field}
        />
      </label>
      <div className="grid grid-cols-[1fr_6rem] gap-2">
        <label className="flex flex-col gap-1 text-sm font-bold">
          {text.cityLabel}
          <input name="city" defaultValue={club?.city} maxLength={80} className={field} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-bold">
          {text.departmentLabel}
          <input
            name="department"
            defaultValue={club?.department}
            maxLength={3}
            className={field}
          />
        </label>
      </div>
      <SubmitButton pendingLabel={text.pendingAction} variant={club ? "muted" : "default"}>
        {club ? text.save : text.create}
      </SubmitButton>
      <Outcome state={state} />
    </form>
  );
}

export function ValidateClubForm({ id }: { id: string }) {
  const [state, action] = useActionState<ClubActionState, FormData>(validateClubAction, {});
  return (
    <form action={action} className="flex flex-col gap-1.5">
      <input type="hidden" name="id" value={id} />
      <SubmitButton pendingLabel={text.pendingAction}>{text.validate}</SubmitButton>
      <Outcome state={state} />
    </form>
  );
}

export function DeleteClubForm({ id, name }: { id: string; name: string }) {
  const [state, action] = useActionState<ClubActionState, FormData>(deleteClubAction, {});
  return (
    <form action={action} className="flex flex-col gap-1.5">
      <input type="hidden" name="id" value={id} />
      <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="confirm"
          value="1"
          className="size-5 shrink-0 accent-primary"
        />
        {text.removeConfirm(name)}
      </label>
      <SubmitButton pendingLabel={text.removing} variant="muted">
        {text.remove}
      </SubmitButton>
      <Outcome state={state} />
    </form>
  );
}
