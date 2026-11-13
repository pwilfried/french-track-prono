"use client";

import { useActionState, useState } from "react";

import { messages } from "@/app/messages.fr";
import { Field } from "@/components/account/field";
import { SubmitButton } from "@/components/account/submit-button";
import { seasonShape, type LeagueCompetition } from "@/domain/manager-league";

import { createManagerLeagueAction, type ManagerLeagueFormState } from "./actions";

const text = messages.manager;

const competitionErrors = new Set(["MANAGER_COMPETITIONS_TOO_FEW", "MANAGER_COMPETITIONS_INVALID"]);

/**
 * The name of the league, whether anyone may join it (#419), and the competitions of its season:
 * the number of players follows, shown as they are picked (#644).
 */
export function CreateManagerLeagueForm({ competitions }: { competitions: LeagueCompetition[] }) {
  const [state, action] = useActionState<ManagerLeagueFormState, FormData>(
    createManagerLeagueAction,
    { value: "", isPublic: false, competitionIds: [] },
  );
  const [picked, setPicked] = useState(() => new Set(state.competitionIds));
  const toggle = (id: string, on: boolean) =>
    setPicked((current) => {
      const next = new Set(current);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  const shape = seasonShape(picked.size);
  const competitionError =
    state.error && competitionErrors.has(state.error) ? messages.errors[state.error] : undefined;
  const nameError =
    state.error && !competitionErrors.has(state.error) ? messages.errors[state.error] : undefined;
  return (
    <form action={action} noValidate className="flex flex-col gap-5">
      <Field
        id="name"
        name="name"
        label={text.nameLabel}
        hint={text.nameHint}
        error={nameError}
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

      <fieldset className="flex flex-col gap-2" aria-describedby="competitions-hint">
        <legend className="text-sm font-bold">{text.competitionsLabel}</legend>
        <p id="competitions-hint" className="text-sm text-muted-foreground">
          {text.competitionsHint}
        </p>
        {competitions.length === 0 ? (
          <p className="rounded-2xl bg-muted px-3.5 py-3 text-sm">{text.competitionsEmpty}</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {competitions.map((c) => (
              <li key={c.id}>
                <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-2xl border-2 border-border bg-card px-3.5 py-2 has-checked:border-primary">
                  <input
                    type="checkbox"
                    name="competition"
                    value={c.id}
                    checked={picked.has(c.id)}
                    onChange={(e) => toggle(c.id, e.target.checked)}
                    className="size-5 shrink-0 accent-primary"
                  />
                  <span className="flex min-w-0 flex-col">
                    <span className="break-words font-semibold">{c.name}</span>
                    <span className="text-sm text-muted-foreground">{text.day(c.startsAt)}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}
        <p
          role="status"
          className={`rounded-2xl px-3.5 py-3 text-sm font-semibold ${shape ? "bg-success/15 text-success-text" : "bg-muted text-foreground"}`}
        >
          {shape ? text.seasonLine(picked.size, shape) : text.seasonTooFew(picked.size)}
        </p>
        {competitionError && (
          <p role="alert" className="text-sm font-semibold text-accent-text">
            {competitionError}
          </p>
        )}
      </fieldset>
      <SubmitButton pendingLabel={text.creating}>{text.submit}</SubmitButton>
    </form>
  );
}
