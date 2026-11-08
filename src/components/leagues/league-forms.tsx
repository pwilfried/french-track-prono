"use client";

import { useActionState } from "react";

import { messages } from "@/app/messages.fr";
import { Field } from "@/components/account/field";
import { SubmitButton } from "@/components/account/submit-button";

import {
  addLeagueCompetitionAction,
  createLeagueAction,
  handOverLeagueAction,
  joinLeagueAction,
  leaveLeagueAction,
  type LeagueFormState,
} from "@/app/ligues/actions";

/** The league counts the competitions given (sent as hidden fields). */
export function CreateLeagueForm({ competitionSlugs }: { competitionSlugs: string[] }) {
  const [state, action] = useActionState<LeagueFormState, FormData>(createLeagueAction, {
    value: "",
  });
  return (
    <form action={action} noValidate className="flex flex-col gap-5">
      {competitionSlugs.map((slug) => (
        <input key={slug} type="hidden" name="competition" value={slug} />
      ))}
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
      <SubmitButton pendingLabel={messages.leagues.creating}>
        {messages.leagues.createSubmit}
      </SubmitButton>
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
  members: { userId: string; pseudo: string; avatar: string }[];
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
            <span aria-hidden>{m.avatar}</span>
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

/** The creator picks a coming competition that the league does not count yet. */
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
  if (choices.length === 0) {
    return <p className="text-sm text-muted-foreground">{messages.leagues.nothingToAdd}</p>;
  }
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
