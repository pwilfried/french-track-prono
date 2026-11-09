"use client";

import { useActionState } from "react";

import { ClubPicker } from "@/components/account/club-picker";
import { DisciplinePicker } from "@/components/account/discipline-picker";
import { Field } from "@/components/account/field";
import { SubmitButton } from "@/components/account/submit-button";
import type { Discipline } from "@/domain/discipline";
import { AVATARS } from "@/domain/profile";

import { findClubsAction } from "../club-actions";
import { messages } from "../messages.fr";
import { createProfileAction, type WelcomeState } from "./actions";

const SEXES = [
  { value: "F", label: messages.welcome.sexF },
  { value: "M", label: messages.welcome.sexM },
  { value: "", label: messages.welcome.sexNone },
];

export function WelcomeForm({
  next,
  disciplines,
}: {
  next: string;
  disciplines: Pick<Discipline, "name" | "family">[];
}) {
  const [state, action] = useActionState<WelcomeState, FormData>(createProfileAction, {
    pseudo: "",
    avatar: "",
    ageConfirmed: false,
    sex: "",
    disciplines: [],
    club: null,
    newClubName: "",
    newClubCity: "",
  });
  const error = state.error;
  const text = error ? messages.errors[error] : undefined;
  const pseudoError = error === "PSEUDO_INVALID" || error === "PSEUDO_TAKEN" ? text : undefined;
  const avatarError = error === "AVATAR_INVALID" ? text : undefined;
  const ageError = error === "AGE_NOT_CONFIRMED" ? text : undefined;
  const sexError = error === "SEX_INVALID" ? text : undefined;
  const clubError =
    error === "CLUB_NAME_INVALID" || error === "CLUB_NAME_BANNED" || error === "CLUB_UNKNOWN"
      ? text
      : undefined;
  const generalError =
    text && !pseudoError && !avatarError && !ageError && !sexError && !clubError ? text : undefined;

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

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
          {messages.welcome.sexLabel}
        </legend>
        <div className="flex flex-wrap gap-2">
          {SEXES.map((sex) => (
            <label key={sex.value} className="cursor-pointer">
              <input
                type="radio"
                name="sex"
                value={sex.value}
                defaultChecked={state.sex === sex.value}
                className="peer sr-only"
              />
              <span className="inline-flex min-h-11 items-center rounded-full border-2 border-border bg-card px-4 text-sm font-semibold peer-checked:border-primary peer-checked:bg-primary peer-checked:text-primary-foreground peer-focus-visible:ring-4 peer-focus-visible:ring-ring">
                {sex.label}
              </span>
            </label>
          ))}
        </div>
        {sexError ? (
          <p role="alert" className="text-sm font-semibold text-accent-text">
            {sexError}
          </p>
        ) : null}
      </fieldset>

      <DisciplinePicker disciplines={disciplines} chosen={state.disciplines} />

      <ClubPicker
        initial={{
          club: state.club,
          newClubName: state.newClubName,
          newClubCity: state.newClubCity,
        }}
        search={findClubsAction}
        error={clubError}
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
    </form>
  );
}
