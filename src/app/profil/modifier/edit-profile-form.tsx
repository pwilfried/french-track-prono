"use client";

import { useActionState } from "react";

import { BibPicker } from "@/components/account/bib-picker";
import { ClubPicker } from "@/components/account/club-picker";
import { DisciplinePicker } from "@/components/account/discipline-picker";
import { Field } from "@/components/account/field";
import { SexPicker } from "@/components/account/sex-picker";
import { SubmitButton } from "@/components/account/submit-button";
import type { Discipline } from "@/domain/discipline";

import { findClubsAction } from "../../club-actions";
import { messages } from "../../messages.fr";
import { editProfileAction, type EditProfileState } from "./actions";

export function EditProfileForm({
  initial,
  disciplines,
}: {
  initial: EditProfileState;
  disciplines: Pick<Discipline, "name" | "family">[];
}) {
  const [state, action] = useActionState<EditProfileState, FormData>(editProfileAction, initial);
  const error = state.error;
  const text = error ? messages.errors[error] : undefined;
  const pseudoError =
    error === "PSEUDO_INVALID" || error === "PSEUDO_TAKEN" || error === "PSEUDO_BANNED"
      ? text
      : undefined;
  const bibNumberError = error === "BIB_NUMBER_INVALID" ? text : undefined;
  const bibColorError = error === "BIB_COLOR_INVALID" ? text : undefined;
  const sexError = error === "SEX_INVALID" ? text : undefined;
  const clubError =
    error === "CLUB_NAME_INVALID" || error === "CLUB_NAME_BANNED" || error === "CLUB_UNKNOWN"
      ? text
      : undefined;
  const generalError =
    text && !pseudoError && !bibNumberError && !bibColorError && !sexError && !clubError
      ? text
      : undefined;

  return (
    <form action={action} noValidate className="flex flex-col gap-5">
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
        pseudo={state.pseudo}
        numberError={bibNumberError}
        colorError={bibColorError}
      />
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
      {generalError ? (
        <p role="alert" className="rounded-card bg-muted p-4 font-semibold">
          {generalError}
        </p>
      ) : null}
      <SubmitButton pendingLabel={messages.editProfile.saving}>
        {messages.editProfile.save}
      </SubmitButton>
    </form>
  );
}
