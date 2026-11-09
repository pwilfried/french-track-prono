"use client";

import { useActionState } from "react";

import { Captcha } from "@/components/account/captcha";
import { Field } from "@/components/account/field";
import { SubmitButton } from "@/components/account/submit-button";

import { messages } from "../messages.fr";
import { signInAction, type SignInState } from "./actions";

export function SignInForm({ next, linkError }: { next: string; linkError: boolean }) {
  const [current, action] = useActionState<SignInState, FormData>(signInAction, {
    step: "email",
    email: "",
  });

  if (current.step === "email") {
    return (
      <form action={action} noValidate className="flex flex-col gap-4">
        <Field
          id="email"
          name="email"
          type="email"
          label={messages.signIn.emailLabel}
          hint={messages.signIn.emailHint}
          error={current.error ? messages.errors[current.error] : undefined}
          defaultValue={current.email}
          autoComplete="email"
          inputMode="email"
          required
        />
        {linkError && !current.error ? (
          <p role="alert" className="text-sm font-semibold text-accent-text">
            {messages.signIn.linkInvalid}
          </p>
        ) : null}
        <Captcha />
        <SubmitButton intent="send" pendingLabel={messages.signIn.sending}>
          {messages.signIn.send}
        </SubmitButton>
        <p className="rounded-card bg-muted p-4 text-sm text-muted-foreground">
          {messages.signIn.firstTime}
        </p>
      </form>
    );
  }

  return (
    <form action={action} noValidate className="flex flex-col gap-4">
      <input type="hidden" name="email" value={current.email} />
      <input type="hidden" name="next" value={next} />
      <div className="rounded-card bg-muted p-4 text-center">
        <p className="font-bold">{messages.signIn.waysTitle}</p>
        <p className="mt-1 text-sm text-muted-foreground">{messages.signIn.waysBody}</p>
      </div>
      <Field
        id="code"
        name="code"
        label={messages.signIn.codeLabel}
        error={current.error ? messages.errors[current.error] : undefined}
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={10}
        required
        className="text-center text-2xl font-extrabold tracking-[0.3em]"
      />
      {current.resent ? (
        <p role="status" className="text-sm font-semibold text-success-text">
          {messages.signIn.resent}
        </p>
      ) : null}
      <Captcha />
      <SubmitButton intent="verify" pendingLabel={messages.signIn.verifying}>
        {messages.signIn.verify}
      </SubmitButton>
      <div className="grid grid-cols-2 gap-3">
        <SubmitButton
          intent="resend"
          variant="muted"
          pendingLabel={messages.signIn.sending}
          noValidate
        >
          {messages.signIn.resend}
        </SubmitButton>
        <SubmitButton
          intent="change"
          variant="muted"
          pendingLabel={messages.signIn.changeEmail}
          noValidate
        >
          {messages.signIn.changeEmail}
        </SubmitButton>
      </div>
      <p className="rounded-card bg-muted p-4 text-sm text-muted-foreground">
        {messages.signIn.codeNote}
      </p>
    </form>
  );
}
