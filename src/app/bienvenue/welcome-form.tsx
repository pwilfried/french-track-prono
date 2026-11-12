"use client";

import { useActionState } from "react";

import { BibPicker } from "@/components/account/bib-picker";
import { Field } from "@/components/account/field";
import { SubmitButton } from "@/components/account/submit-button";
import type { Bib } from "@/domain/bib";

import { messages } from "../messages.fr";
import { createProfileAction, type WelcomeState } from "./actions";

export function WelcomeForm({
  next,
  bib,
}: {
  next: string;
  /** Drawn at random by the page, so that the newcomer may keep it as is. */
  bib: Bib;
}) {
  const [state, action] = useActionState<WelcomeState, FormData>(createProfileAction, {
    pseudo: "",
    bibNumber: String(bib.number),
    bibColor: bib.color,
    ageConfirmed: false,
  });
  const error = state.error;
  const text = error ? messages.errors[error] : undefined;
  const pseudoError = error === "PSEUDO_INVALID" || error === "PSEUDO_TAKEN" ? text : undefined;
  const bibNumberError = error === "BIB_NUMBER_INVALID" ? text : undefined;
  const bibColorError = error === "BIB_COLOR_INVALID" ? text : undefined;
  const ageError = error === "AGE_NOT_CONFIRMED" ? text : undefined;
  const fieldError = pseudoError || bibNumberError || bibColorError || ageError;
  const generalError = text && !fieldError ? text : undefined;

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

      <BibPicker
        chosen={{ number: state.bibNumber, color: state.bibColor }}
        numberError={bibNumberError}
        colorError={bibColorError}
      />

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
      <p className="text-center text-sm text-muted-foreground">{messages.welcome.later}</p>
    </form>
  );
}
