"use client";

import { useActionState } from "react";

import { Field } from "@/components/account/field";
import { SubmitButton } from "@/components/account/submit-button";
import { MAX_EMAIL_LENGTH } from "@/domain/auth";

import { messages } from "../../messages.fr";
import { changeEmailAction, type EmailChangeState } from "./actions";

const text = messages.changeEmail;

export function EmailForm() {
  const [state, action] = useActionState<EmailChangeState, FormData>(changeEmailAction, {
    step: "ask",
    email: "",
  });
  const error = state.error ? messages.errors[state.error] : undefined;

  if (state.step === "code") {
    return (
      <form action={action} noValidate className="flex flex-col gap-5">
        <p role="status" className="rounded-card bg-muted p-4">
          {text.sent(state.email)}
        </p>
        <Field
          id="code"
          name="code"
          label={text.codeLabel}
          error={error}
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={12}
        />
        <SubmitButton pendingLabel={text.confirming}>{text.confirm}</SubmitButton>
      </form>
    );
  }
  return (
    <form action={action} noValidate className="flex flex-col gap-5">
      <Field
        id="email"
        name="email"
        type="email"
        label={text.emailLabel}
        hint={text.emailHint}
        error={error}
        defaultValue={state.email}
        autoComplete="email"
        inputMode="email"
        maxLength={MAX_EMAIL_LENGTH}
      />
      <SubmitButton pendingLabel={text.sending}>{text.send}</SubmitButton>
    </form>
  );
}
