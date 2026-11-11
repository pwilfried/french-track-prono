"use client";

import { useActionState } from "react";

import { messages } from "@/app/messages.fr";
import { Field } from "@/components/account/field";
import { SubmitButton } from "@/components/account/submit-button";

import { createManagerLeagueAction, type ManagerLeagueFormState } from "./actions";

const text = messages.manager;

/** The name of the league and whether anyone may join it (#419). */
export function CreateManagerLeagueForm() {
  const [state, action] = useActionState<ManagerLeagueFormState, FormData>(
    createManagerLeagueAction,
    { value: "", isPublic: false },
  );
  return (
    <form action={action} noValidate className="flex flex-col gap-5">
      <Field
        id="name"
        name="name"
        label={text.nameLabel}
        hint={text.nameHint}
        error={state.error ? messages.errors[state.error] : undefined}
        defaultValue={state.value}
        maxLength={60}
        autoComplete="off"
      />
      <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-2xl border-2 border-border bg-card px-3.5 py-3 has-checked:border-primary">
        <input
          type="checkbox"
          name="public"
          value="1"
          defaultChecked={state.isPublic}
          aria-describedby="public-hint"
          className="mt-0.5 size-5 shrink-0 accent-primary"
        />
        <span className="flex flex-col gap-0.5">
          <span className="font-bold">{text.publicLabel}</span>
          <span id="public-hint" className="text-sm text-muted-foreground">
            {text.publicHint}
          </span>
        </span>
      </label>
      <SubmitButton pendingLabel={text.creating}>{text.submit}</SubmitButton>
    </form>
  );
}
