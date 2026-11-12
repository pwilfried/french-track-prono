"use client";

import { useActionState, useRef } from "react";

import { AccountHero } from "@/components/account/account-hero";
import { Captcha } from "@/components/account/captcha";
import { Field } from "@/components/account/field";
import { PasteCodeButton } from "@/components/account/paste-code-button";
import { SubmitButton } from "@/components/account/submit-button";

import { messages } from "../messages.fr";
import { signInAction, type SignInState } from "./actions";

/**
 * Sign-in and sign-up are one flow: an e-mail, then the code it receives. `eventName` is the
 * open event the visitor came from, kept in view on the e-mail screen.
 */
export function SignInForm({
  next,
  linkError,
  eventName,
}: {
  next: string;
  linkError: boolean;
  eventName: string | null;
}) {
  const [current, action] = useActionState<SignInState, FormData>(signInAction, {
    step: "email",
    email: "",
  });
  const codeForm = useRef<HTMLFormElement>(null);

  // A pasted code fills the field and signs in, as if « Me connecter » were pressed.
  function signInWith(code: string) {
    const form = codeForm.current;
    const field = form?.elements.namedItem("code");
    if (!form || !(field instanceof HTMLInputElement)) return;
    field.value = code;
    form.requestSubmit(form.querySelector<HTMLButtonElement>('button[value="verify"]'));
  }

  if (current.step === "email") {
    return (
      <>
        {eventName ? (
          <p
            role="note"
            className="mx-4 mt-4 rounded-card bg-primary-soft p-4 text-sm font-semibold text-primary-ink sm:mx-auto sm:w-full sm:max-w-md"
          >
            {messages.signIn.eventWaiting(eventName)}
          </p>
        ) : null}
        <AccountHero title={messages.signIn.title} subtitle={messages.signIn.subtitle} />
        <div className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 py-5">
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
          </form>
          <ul className="flex flex-col gap-2 text-sm">
            {messages.signIn.perks.map((perk) => (
              <li key={perk} className="flex items-start gap-2">
                <span aria-hidden="true" className="font-bold text-success-text">
                  ✓
                </span>
                {perk}
              </li>
            ))}
          </ul>
        </div>
      </>
    );
  }

  // « Autre e-mail » shows at the top right but comes last in the form, so that pressing Enter
  // in the code field signs in rather than going back.
  return (
    <form ref={codeForm} action={action} noValidate className="relative">
      <input type="hidden" name="email" value={current.email} />
      <input type="hidden" name="next" value={next} />
      <header className="px-4 pb-2 pt-6">
        <div className="mx-auto max-w-md pr-32">
          <h1 className="font-display text-3xl font-extrabold leading-none">
            {messages.signIn.codeTitle}
          </h1>
        </div>
        <p className="mx-auto mt-2 max-w-md text-muted-foreground">
          {messages.signIn.sentTo}{" "}
          <strong className="break-all font-bold text-foreground">{current.email}</strong>
        </p>
      </header>
      <div className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 py-5">
        <Field
          id="code"
          name="code"
          label={messages.signIn.codeLabel}
          error={current.error ? messages.errors[current.error] : undefined}
          inputMode="numeric"
          autoComplete="one-time-code"
          // Six digits; room for a pasted « 123 456 », which the server tidies.
          maxLength={10}
          placeholder="••••••"
          required
          className="min-h-16 text-center text-3xl font-extrabold tracking-[0.4em]"
        />
        <PasteCodeButton onCode={signInWith} />
        {current.resent ? (
          <p role="status" className="text-sm font-semibold text-success-text">
            {messages.signIn.resent}
          </p>
        ) : null}
        <Captcha />
        <SubmitButton intent="verify" pendingLabel={messages.signIn.verifying}>
          {messages.signIn.verify}
        </SubmitButton>
        <p className="rounded-card bg-muted p-4 text-sm font-semibold">{messages.signIn.linkTip}</p>
        <p className="text-sm text-muted-foreground">{messages.signIn.codeNote}</p>
        <SubmitButton
          intent="resend"
          variant="muted"
          pendingLabel={messages.signIn.sending}
          noValidate
        >
          {messages.signIn.resend}
        </SubmitButton>
      </div>
      <div className="absolute right-4 top-5 sm:right-[max(1rem,calc(50%-14rem))]">
        <SubmitButton
          intent="change"
          variant="outline"
          pendingLabel={messages.signIn.changeEmail}
          className="px-4 text-sm"
          noValidate
        >
          {messages.signIn.changeEmail}
        </SubmitButton>
      </div>
    </form>
  );
}
