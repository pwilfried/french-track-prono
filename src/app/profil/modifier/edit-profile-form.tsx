"use client";

import Link from "next/link";
import { useActionState, useRef, useState } from "react";

import { BibPicker } from "@/components/account/bib-picker";
import { ClubPicker } from "@/components/account/club-picker";
import { DisciplinePicker } from "@/components/account/discipline-picker";
import { Field } from "@/components/account/field";
import { SexPicker } from "@/components/account/sex-picker";
import { SubmitButton } from "@/components/account/submit-button";
import { Bib } from "@/components/profile/bib";
import { DEFAULT_BIB, isBibColor, validateBib, type Bib as BibValue } from "@/domain/bib";
import type { Discipline } from "@/domain/discipline";

import { messages } from "../../messages.fr";
import type { Club } from "@/application/clubs";

import type { EditProfileState } from "./actions";

const text = messages.editProfile;

const startBib = (state: EditProfileState): BibValue => {
  const valid = validateBib(state.bibNumber, DEFAULT_BIB.color);
  return {
    number: valid.ok ? valid.bib.number : 0,
    color: isBibColor(state.bibColor) ? state.bibColor : DEFAULT_BIB.color,
  };
};

const SEX_LABEL: Record<string, string> = {
  F: messages.welcome.sexF,
  M: messages.welcome.sexM,
};

/** « Femme · 100 m, 100 m haies », or a line saying nothing is filled in. */
const summarise = (sex: string, disciplines: string[]): string => {
  const parts: string[] = [];
  if (SEX_LABEL[sex]) parts.push(SEX_LABEL[sex]);
  if (disciplines.length > 0) parts.push(disciplines.join(", "));
  return parts.length > 0 ? text.privateSummary(parts) : text.privateNone;
};

export function EditProfileForm({
  initial,
  disciplines,
  clubValidated,
  save,
  searchClubs,
}: {
  /** The server action; a story passes a stand-in. */
  save: (state: EditProfileState, data: FormData) => Promise<EditProfileState>;
  searchClubs: (query: string) => Promise<Club[]>;
  initial: EditProfileState;
  disciplines: Pick<Discipline, "name" | "family">[];
  /** Whether the club on file is validated (null: no club). */
  clubValidated: boolean | null;
}) {
  const [state, action] = useActionState<EditProfileState, FormData>(save, initial);
  const form = useRef<HTMLFormElement>(null);
  const [pseudo, setPseudo] = useState(initial.pseudo);
  const [bib, setBib] = useState<BibValue>(() => startBib(initial));
  const [clubName, setClubName] = useState(initial.club?.name ?? initial.newClubName);
  const [privateOpen, setPrivateOpen] = useState(false);
  const [summary, setSummary] = useState(() => summarise(initial.sex, initial.disciplines));

  const error = state.error;
  const message = error ? messages.errors[error] : undefined;
  const pseudoError =
    error === "PSEUDO_INVALID" || error === "PSEUDO_TAKEN" || error === "PSEUDO_BANNED"
      ? message
      : undefined;
  const bibNumberError = error === "BIB_NUMBER_INVALID" ? message : undefined;
  const bibColorError = error === "BIB_COLOR_INVALID" ? message : undefined;
  const sexError = error === "SEX_INVALID" ? message : undefined;
  const clubError =
    error === "CLUB_NAME_INVALID" || error === "CLUB_NAME_BANNED" || error === "CLUB_UNKNOWN"
      ? message
      : undefined;
  const generalError =
    message && !pseudoError && !bibNumberError && !bibColorError && !sexError && !clubError
      ? message
      : undefined;
  // The private box opens by itself when it carries the error.
  const privateShown = privateOpen || Boolean(sexError);
  const statusShown = clubName !== "" && clubName === initial.club?.name && clubValidated !== null;

  return (
    <form ref={form} action={action} noValidate className="flex flex-col gap-4">
      <section aria-label={text.previewLabel} className="flex justify-center py-2">
        <Bib
          bib={bib}
          size="large"
          pseudo={pseudo.trim() === "" ? text.emptyPseudo : pseudo}
          club={clubName || undefined}
          className="max-w-65"
        />
      </section>

      <section className="flex flex-col gap-4 rounded-card border border-border bg-card p-4">
        <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
          {text.bibCard}
        </h2>
        <Field
          id="pseudo"
          name="pseudo"
          label={text.pseudoLabel}
          hint={messages.welcome.pseudoHint}
          error={pseudoError}
          value={pseudo}
          onChange={(event) => setPseudo(event.target.value)}
          autoComplete="nickname"
          maxLength={40}
        />
        <BibPicker
          chosen={{ number: state.bibNumber, color: state.bibColor }}
          hidePreview
          numberError={bibNumberError}
          colorError={bibColorError}
          onPreview={setBib}
        />
      </section>

      <section className="flex flex-col gap-3 rounded-card border border-border bg-card p-4">
        <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
          {text.clubCard}
        </h2>
        {statusShown ? (
          <p className="text-sm font-semibold">
            {clubValidated ? text.clubValidated : text.toValidate}
          </p>
        ) : null}
        <ClubPicker
          initial={{
            club: state.club,
            newClubName: state.newClubName,
            newClubCity: state.newClubCity,
          }}
          search={searchClubs}
          error={clubError}
          onClubName={setClubName}
        />
      </section>

      <section className="flex flex-col gap-3 rounded-card border-2 border-dashed border-border bg-muted p-4">
        <button
          type="button"
          aria-expanded={privateShown}
          aria-controls="private-details"
          onClick={() => {
            if (privateShown && form.current) {
              const data = new FormData(form.current);
              setSummary(
                summarise(String(data.get("sex") ?? ""), data.getAll("discipline").map(String)),
              );
            }
            setPrivateOpen(!privateShown);
          }}
          className="flex min-h-11 w-full flex-col items-start gap-1 text-left"
        >
          <span className="font-bold">{text.privateTitle}</span>
          {privateShown ? null : <span className="text-sm text-muted-foreground">{summary}</span>}
        </button>
        {/* Folded, not removed: the choices are still sent with the form. */}
        <div id="private-details" hidden={!privateShown} className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">{text.privateHint}</p>
          <SexPicker chosen={state.sex} error={sexError} />
          <DisciplinePicker disciplines={disciplines} chosen={state.disciplines} />
        </div>
      </section>

      {generalError ? (
        <p role="alert" className="rounded-card bg-muted p-4 font-semibold">
          {generalError}
        </p>
      ) : null}

      <div className="sticky bottom-0 -mx-4 flex flex-col gap-1 border-t border-border bg-background px-4 pb-3 pt-3">
        <SubmitButton pendingLabel={text.saving}>{text.save}</SubmitButton>
        <Link
          href="/profil"
          className="flex min-h-11 items-center justify-center font-semibold text-primary underline underline-offset-4"
        >
          {text.cancelEdit}
        </Link>
      </div>
    </form>
  );
}
