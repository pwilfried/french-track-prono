"use client";

import { useActionState } from "react";

import { AvatarPicker } from "@/components/account/avatar-picker";
import { ClubPicker } from "@/components/account/club-picker";
import { DisciplinePicker } from "@/components/account/discipline-picker";
import { Field } from "@/components/account/field";
import { SexPicker } from "@/components/account/sex-picker";
import { SubmitButton } from "@/components/account/submit-button";
import type { Discipline } from "@/domain/discipline";

import { findClubsAction } from "../club-actions";
import { messages } from "../messages.fr";
import { createProfileAction, type WelcomeState } from "./actions";

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

      <AvatarPicker chosen={state.avatar} error={avatarError} />

      <SexPicker chosen={state.sex} error={sexError} />

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
