"use client";

import { useActionState } from "react";

import { Field } from "@/components/account/field";
import { SubmitButton } from "@/components/account/submit-button";
import { AVATARS } from "@/domain/profile";

import { messages } from "../messages.fr";
import { createProfileAction, type WelcomeState } from "./actions";

export function WelcomeForm({ next }: { next: string }) {
  const [state, action] = useActionState<WelcomeState, FormData>(createProfileAction, {
    pseudo: "",
    avatar: "",
    ageConfirmed: false,
  });
  const error = state.error;
  const text = error ? messages.errors[error] : undefined;
  const pseudoError = error === "PSEUDO_INVALID" || error === "PSEUDO_TAKEN" ? text : undefined;
  const avatarError = error === "AVATAR_INVALID" ? text : undefined;
  const ageError = error === "AGE_NOT_CONFIRMED" ? text : undefined;
  const generalError = text && !pseudoError && !avatarError && !ageError ? text : undefined;

  return (
    <form action={action} noValidate className="flex flex-col gap-5">
      <input type="hidden" name="next" value={next} />
      <Field
        id="pseudo"
        name="pseudo"
        label={messages.welcome.pseudoLabel}
        hint={messages.welcome.pseudoHint}
        error={pseudoError}
        defaultValue={state.pseudo}
        autoComplete="nickname"
        maxLength={40}
      />

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
          {messages.welcome.avatarLabel}
        </legend>
        <div className="grid grid-cols-4 gap-2.5">
          {AVATARS.map((avatar) => (
            <label key={avatar} className="cursor-pointer">
              <input
                type="radio"
                name="avatar"
                value={avatar}
                defaultChecked={state.avatar === avatar}
                className="peer sr-only"
              />
              <span
                aria-hidden="true"
                className="grid aspect-square min-h-16 place-items-center rounded-2xl border-2 border-border bg-card text-3xl peer-checked:border-primary peer-checked:bg-muted peer-checked:ring-4 peer-checked:ring-primary/25 peer-focus-visible:ring-4 peer-focus-visible:ring-ring"
              >
                {avatar}
              </span>
            </label>
          ))}
        </div>
        {avatarError ? (
          <p role="alert" className="text-sm font-semibold text-accent-text">
            {avatarError}
          </p>
        ) : null}
      </fieldset>

      <div className="flex flex-col gap-1">
        <label className="flex min-h-12 cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            name="age"
            defaultChecked={state.ageConfirmed}
            aria-invalid={ageError ? true : undefined}
            aria-describedby={ageError ? "age-error" : undefined}
            className="size-7 shrink-0 accent-primary"
          />
          <span>
            <span className="block font-bold">{messages.welcome.ageLabel}</span>
            <span className="block text-sm text-muted-foreground">{messages.welcome.ageHint}</span>
          </span>
        </label>
        {ageError ? (
          <p id="age-error" role="alert" className="text-sm font-semibold text-accent-text">
            {ageError}
          </p>
        ) : null}
      </div>

      {generalError ? (
        <p role="alert" className="rounded-card bg-muted p-4 font-semibold">
          {generalError}
        </p>
      ) : null}
      <SubmitButton pendingLabel={messages.welcome.submitting}>
        {messages.welcome.submit}
      </SubmitButton>
    </form>
  );
}
