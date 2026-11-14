"use client";

import { useActionState, useState } from "react";

import { messages } from "@/app/messages.fr";
import { Field } from "@/components/account/field";
import { SubmitButton } from "@/components/account/submit-button";
import { Bib } from "@/components/profile/bib";
import type { Bib as BibValue } from "@/domain/bib";
import type { LeagueFamily } from "@/domain/league-families";
import type { PickableCompetition } from "@/domain/season-picker";

import { LeagueFamilyPicker } from "./league-family-picker";
import { SeasonCompetitionPicker } from "./season-competition-picker";

import {
  addLeagueCompetitionAction,
  addLeagueFamilyAction,
  createLeagueAction,
  joinPublicLeagueAction,
  reportLeagueAction,
  handOverLeagueAction,
  joinLeagueAction,
  leaveLeagueAction,
  type LeagueFormState,
} from "@/app/ligues/actions";

/**
 * The name of the league, whether anyone may join it, its families, then its competitions (#721):
 * the season picker of the Manager, on the same page, so the name typed is never lost. At least
 * one, not finished (#614); the picker ends with the submit button, in its sticky bar.
 */
export function CreateLeagueForm({
  competitions,
  chosen,
  isPublic = false,
}: {
  /** The competitions a league can count: not finished. */
  competitions: PickableCompetition[];
  /** Ticked from the start (the slugs given in the address). */
  chosen: string[];
  /** Ticks « Ligue publique » from the start (the home's « Créer une ligue publique », #369). */
  isPublic?: boolean;
}) {
  const [state, action] = useActionState<LeagueFormState, FormData>(createLeagueAction, {
    value: "",
    isPublic,
  });
  const [ready, setReady] = useState(true);
  return (
    <form action={action} noValidate className="flex flex-col gap-5">
      <Field
        id="name"
        name="name"
        label={messages.leagues.nameLabel}
        hint={messages.leagues.nameHint}
        error={state.error ? messages.errors[state.error] : undefined}
        defaultValue={state.value}
        maxLength={60}
        autoComplete="off"
      />
      <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-2xl border-2 border-border bg-card px-3.5 py-3 has-checked:border-primary">
        <input
          type="checkbox"
          name="public"
          value="1"
          defaultChecked={state.isPublic}
          aria-describedby="public-hint"
          className="mt-0.5 size-5 shrink-0 accent-primary"
        />
        <span className="flex flex-col gap-0.5">
          <span className="font-bold">{messages.leagues.publicLabel}</span>
          <span id="public-hint" className="text-sm text-muted-foreground">
            {messages.leagues.publicHint}
          </span>
        </span>
      </label>
      <LeagueFamilyPicker
        key={state.families?.join() ?? ""}
        defaultFamilies={state.families}
        onReadyChange={setReady}
      />
      <SeasonCompetitionPicker
        competitions={competitions}
        chosen={chosen}
        name="competition"
        minimum={1}
        label={messages.leagues.competitionsTitle}
        hint={messages.leagues.how}
        empty={messages.leagues.createNone}
        submitLabel={messages.leagues.createSubmit}
        pendingLabel={messages.leagues.creating}
        blocked={!ready}
      />
    </form>
  );
}

export function JoinLeagueForm({
  initialCode = "",
  back,
}: {
  initialCode?: string;
  back?: string;
}) {
  const [state, action] = useActionState<LeagueFormState, FormData>(joinLeagueAction, {
    value: initialCode,
  });
  return (
    <form action={action} noValidate className="flex flex-col gap-5">
      {back && <input type="hidden" name="back" value={back} />}
      <Field
        id="code"
        name="code"
        label={messages.leagues.codeLabel}
        hint={messages.leagues.codeHint}
        error={state.error ? messages.errors[state.error] : undefined}
        defaultValue={state.value}
        maxLength={12}
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        className="text-center font-mono text-2xl font-extrabold uppercase tracking-[0.3em]"
      />
      <SubmitButton pendingLabel={messages.leagues.joining}>
        {messages.leagues.joinSubmit}
      </SubmitButton>
    </form>
  );
}

/** One button to join from an invite link; a wrong code shows its message. */
export function JoinByLinkForm({ code }: { code: string }) {
  const [state, action] = useActionState<LeagueFormState, FormData>(joinLeagueAction, {
    value: code,
  });
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="code" value={code} />
      <input type="hidden" name="back" value={`/rejoindre/${code}`} />
      {state.error && (
        <p role="alert" className="text-sm font-semibold text-accent-text">
          {messages.errors[state.error]}
        </p>
      )}
      <SubmitButton pendingLabel={messages.leagues.joining}>
        {messages.leagues.joinSubmit}
      </SubmitButton>
    </form>
  );
}

export function LeaveLeagueForm({ leagueId }: { leagueId: string }) {
  const [state, action] = useActionState<LeagueFormState, FormData>(leaveLeagueAction, {
    value: leagueId,
  });
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="leagueId" value={leagueId} />
      {state.error && (
        <p role="alert" className="text-sm font-semibold text-accent-text">
          {messages.errors[state.error]}
        </p>
      )}
      <SubmitButton pendingLabel={messages.leagues.leaving} variant="muted">
        {messages.leagues.leave}
      </SubmitButton>
    </form>
  );
}

export function HandOverForm({
  leagueId,
  members,
}: {
  leagueId: string;
  members: { userId: string; pseudo: string; bib: BibValue }[];
}) {
  const [state, action] = useActionState<LeagueFormState, FormData>(handOverLeagueAction, {
    value: "",
  });
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="leagueId" value={leagueId} />
      <fieldset className="flex flex-col gap-2">
        <legend className="sr-only">{messages.leagues.handOverSubtitle}</legend>
        {members.map((m) => (
          <label
            key={m.userId}
            className="flex min-h-13 cursor-pointer items-center gap-3 rounded-2xl border-2 border-border bg-card px-3.5 has-checked:border-primary has-checked:bg-muted"
          >
            <input
              type="radio"
              name="newOwner"
              value={m.userId}
              defaultChecked={state.value === m.userId}
              required
              className="size-5 accent-primary"
            />
            <Bib bib={m.bib} />
            <span className="min-w-0 flex-1 break-words font-bold">{m.pseudo}</span>
          </label>
        ))}
      </fieldset>
      {state.error && (
        <p role="alert" className="text-sm font-semibold text-accent-text">
          {messages.errors[state.error]}
        </p>
      )}
      <SubmitButton pendingLabel={messages.leagues.handingOver}>
        {messages.leagues.handOverSubmit}
      </SubmitButton>
    </form>
  );
}

/**
 * The creator picks a coming competition that the league does not count yet. Shown only when
 * there is one (`LeagueCompetitions` says so otherwise).
 */
export function AddLeagueCompetitionForm({
  leagueId,
  choices,
}: {
  leagueId: string;
  choices: { slug: string; name: string }[];
}) {
  const [state, action] = useActionState<LeagueFormState, FormData>(addLeagueCompetitionAction, {
    value: choices[0]?.slug ?? "",
  });
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="leagueId" value={leagueId} />
      <label htmlFor="add-competition" className="text-sm font-bold">
        {messages.leagues.addLabel}
      </label>
      <select
        id="add-competition"
        name="competition"
        defaultValue={state.value}
        aria-invalid={state.error ? true : undefined}
        aria-describedby={state.error ? "add-competition-error" : undefined}
        className="min-h-12 rounded-2xl border-2 border-border bg-card px-3 text-base text-card-foreground focus-visible:border-primary focus-visible:outline-none"
      >
        {choices.map((c) => (
          <option key={c.slug} value={c.slug}>
            {c.name}
          </option>
        ))}
      </select>
      {state.error && (
        <p
          id="add-competition-error"
          role="alert"
          className="text-sm font-semibold text-accent-text"
        >
          {messages.errors[state.error]}
        </p>
      )}
      <SubmitButton pendingLabel={messages.leagues.adding}>
        {messages.leagues.addSubmit}
      </SubmitButton>
    </form>
  );
}

/** From an event: adds its competition to one of the player's leagues, then comes back. */
export function AddToMyLeagueForm({
  leagueId,
  leagueName,
  competitionSlug,
  back,
}: {
  leagueId: string;
  leagueName: string;
  competitionSlug: string;
  back: string;
}) {
  const [state, action] = useActionState<LeagueFormState, FormData>(addLeagueCompetitionAction, {
    value: competitionSlug,
  });
  return (
    <form action={action} className="flex flex-col gap-1">
      <input type="hidden" name="leagueId" value={leagueId} />
      <input type="hidden" name="competition" value={competitionSlug} />
      <input type="hidden" name="back" value={back} />
      <SubmitButton pendingLabel={messages.leagues.adding} variant="muted">
        {messages.prediction.leagueAdd(leagueName)}
      </SubmitButton>
      {state.error && (
        <p role="alert" className="text-sm font-semibold text-accent-text">
          {messages.errors[state.error]}
        </p>
      )}
    </form>
  );
}

/** One tap to join a public league, from the list. */
/** « Rejoindre » beside a public league; `label`: a full-width button with that text (#553). */
export function JoinPublicLeagueForm({
  leagueId,
  name,
  label,
}: {
  leagueId: string;
  name: string;
  label?: string;
}) {
  const [state, action, pending] = useActionState<LeagueFormState, FormData>(
    joinPublicLeagueAction,
    { value: leagueId },
  );
  return (
    <form
      action={action}
      className={label ? "flex flex-col gap-1" : "flex shrink-0 flex-col items-end gap-1"}
    >
      <input type="hidden" name="leagueId" value={leagueId} />
      <button
        type="submit"
        disabled={pending}
        aria-label={label ? undefined : messages.leagues.publicJoinLabel(name)}
        className={`inline-flex min-h-11 items-center justify-center rounded-full bg-primary px-4 text-sm font-bold text-primary-foreground disabled:opacity-60 ${label ? "w-full" : ""}`}
      >
        {pending ? messages.leagues.publicJoining : (label ?? messages.leagues.publicJoin)}
      </button>
      {state.error && (
        <p
          role="alert"
          className={`text-xs font-semibold text-accent-text ${label ? "rounded bg-background px-2 py-1" : ""}`}
        >
          {messages.errors[state.error]}
        </p>
      )}
    </form>
  );
}

/** Reports a public league to the admin (#321): once done, says thanks. */
export function ReportLeagueForm({ leagueId, name }: { leagueId: string; name: string }) {
  const [state, action, pending] = useActionState<LeagueFormState, FormData>(reportLeagueAction, {
    value: leagueId,
  });
  if (state.reported) {
    return (
      <p role="status" className="text-xs font-semibold text-success-text">
        {messages.leagues.reported}
      </p>
    );
  }
  return (
    <form action={action} className="flex flex-col items-end">
      <input type="hidden" name="leagueId" value={leagueId} />
      <button
        type="submit"
        disabled={pending}
        aria-label={messages.leagues.reportLabel(name)}
        className="inline-flex min-h-11 items-center text-xs font-semibold text-muted-foreground underline underline-offset-4 disabled:opacity-60"
      >
        {pending ? messages.leagues.reporting : messages.leagues.report}
      </button>
      {state.error && (
        <p role="alert" className="text-xs font-semibold text-accent-text">
          {messages.errors[state.error]}
        </p>
      )}
    </form>
  );
}

/** The creator adds one family (#613); it counts from now on, for the coming events only. */
export function AddLeagueFamilyForm({
  leagueId,
  family,
}: {
  leagueId: string;
  family: LeagueFamily;
}) {
  const [state, action] = useActionState<LeagueFormState, FormData>(addLeagueFamilyAction, {
    value: family,
  });
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="leagueId" value={leagueId} />
      <input type="hidden" name="family" value={family} />
      {state.error && (
        <p role="alert" className="text-sm font-semibold text-accent-text">
          {messages.errors[state.error]}
        </p>
      )}
      <SubmitButton pendingLabel={messages.leagues.addingFamily}>
        {messages.leagues.addFamilySubmit(messages.leagues.family[family])}
      </SubmitButton>
    </form>
  );
}
