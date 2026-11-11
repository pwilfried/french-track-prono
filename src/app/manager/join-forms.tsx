"use client";

import { useActionState } from "react";

import { messages } from "@/app/messages.fr";
import { Field } from "@/components/account/field";
import { SubmitButton } from "@/components/account/submit-button";

import {
  joinManagerLeagueAction,
  joinPublicManagerLeagueAction,
  type JoinManagerLeagueState,
} from "./actions";

const text = messages.manager;

/** The invite code, typed or brought by the link (#420). */
export function JoinManagerLeagueForm({ initialCode }: { initialCode: string }) {
  const [state, action] = useActionState<JoinManagerLeagueState, FormData>(
    joinManagerLeagueAction,
    { value: initialCode },
  );
  return (
    <form action={action} noValidate className="flex flex-col gap-5">
      <Field
        id="code"
        name="code"
        label={text.codeLabel}
        hint={text.codeHint}
        error={state.error ? messages.errors[state.error] : undefined}
        defaultValue={state.value}
        maxLength={12}
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        className="text-center font-mono text-2xl font-extrabold uppercase tracking-[0.3em]"
      />
      <SubmitButton pendingLabel={text.joining}>{text.joinSubmit}</SubmitButton>
    </form>
  );
}

/** One tap to join a public league of the list; a full league says so. */
export function JoinPublicManagerLeagueForm({ id, name }: { id: string; name: string }) {
  const [state, action] = useActionState<JoinManagerLeagueState, FormData>(
    joinPublicManagerLeagueAction,
    { value: id },
  );
  return (
    <form action={action} className="flex flex-col items-end gap-1">
      <input type="hidden" name="league" value={id} />
      <SubmitButton pendingLabel={text.joining} variant="muted">
        <span aria-hidden>{text.join}</span>
        <span className="sr-only">{text.joinLeague(name)}</span>
      </SubmitButton>
      {state.error && (
        <p role="alert" className="text-sm font-semibold text-accent-text">
          {messages.errors[state.error]}
        </p>
      )}
    </form>
  );
}
