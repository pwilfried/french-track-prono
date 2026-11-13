"use client";

import { useActionState } from "react";

import { messages } from "@/app/messages.fr";
import { Field } from "@/components/account/field";
import type { SeasonCompetition } from "@/application/manager-leagues";
import { SubmitButton } from "@/components/account/submit-button";

import { createManagerLeagueAction, type ManagerLeagueFormState } from "./actions";
import { CompetitionPicker } from "./competition-picker";

const text = messages.manager;

/** Errors about the competitions, shown under them rather than under the name. */
const COMPETITION_ERRORS = new Set([
  "MANAGER_COMPETITIONS_TOO_FEW",
  "MANAGER_COMPETITIONS_REFUSED",
]);

/**
 * The name of the league, whether anyone may join it (#419), and its competitions: the number of
 * players follows (#644).
 */
export function CreateManagerLeagueForm({ competitions }: { competitions: SeasonCompetition[] }) {
  const [state, action] = useActionState<ManagerLeagueFormState, FormData>(
    createManagerLeagueAction,
    { value: "", isPublic: false, competitionIds: [] },
  );
  const competitionError = state.error && COMPETITION_ERRORS.has(state.error);
  return (
    <form action={action} noValidate className="flex flex-col gap-5">
      <Field
        id="name"
        name="name"
        label={text.nameLabel}
        hint={text.nameHint}
        error={state.error && !competitionError ? messages.errors[state.error] : undefined}
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
          <span className="font-bold">{text.publicLabel}</span>
          <span id="public-hint" className="text-sm text-muted-foreground">
            {text.publicHint}
          </span>
        </span>
      </label>
      <CompetitionPicker
        competitions={competitions}
        chosen={state.competitionIds}
        label={text.competitionsLabel}
        hint={text.competitionsHint}
      />
      {competitionError && (
        <p role="alert" className="text-sm font-semibold text-accent-text">
          {messages.errors[state.error!]}
        </p>
      )}
      <SubmitButton pendingLabel={text.creating}>{text.submit}</SubmitButton>
    </form>
  );
}
