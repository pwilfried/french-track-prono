"use client";

import { useActionState } from "react";

import { messages } from "@/app/messages.fr";
import { SubmitButton } from "@/components/account/submit-button";
import { PSEUDO_MAX_LENGTH } from "@/domain/profile";

import {
  awardTrophiesAction,
  setWitnessAction,
  type AwardState,
  type WitnessState,
} from "./actions";

const text = messages.adminTrophies;
const field = "min-h-11 w-full rounded-xl border-2 border-border bg-background px-3 text-base";

/** The FrenchTrack account of the Témoin d'or, by its pseudo (#807). */
export function WitnessForm({ pseudo }: { pseudo: string | null }) {
  const [state, action] = useActionState<WitnessState, FormData>(setWitnessAction, {});
  return (
    <form action={action} className="flex flex-col gap-2">
      <label htmlFor="witness" className="text-sm font-semibold">
        {text.witnessLabel}
      </label>
      <input
        id="witness"
        name="pseudo"
        defaultValue={pseudo ?? ""}
        maxLength={PSEUDO_MAX_LENGTH}
        autoComplete="off"
        className={field}
      />
      <SubmitButton pendingLabel={text.saving} variant="muted">
        {text.save}
      </SubmitButton>
      {state.error && (
        <p role="alert" className="text-sm font-semibold text-accent-text">
          {messages.errors[state.error]}
        </p>
      )}
      {state.outcome && (
        <p role="status" className="text-sm font-semibold text-success-text">
          {state.outcome === "saved" ? text.witnessSaved : text.witnessCleared}
        </p>
      )}
    </form>
  );
}

/** Draws the trophies of a season again; they replace the previous ones (#822). */
export function AwardForm({ seasons, current }: { seasons: number[]; current: number }) {
  const [state, action] = useActionState<AwardState, FormData>(awardTrophiesAction, {});
  return (
    <form action={action} className="flex flex-col gap-2">
      <label htmlFor="season" className="text-sm font-semibold">
        {text.seasonLabel}
      </label>
      <select id="season" name="season" defaultValue={String(current)} className={field}>
        {seasons.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      <SubmitButton pendingLabel={text.awarding}>{text.award}</SubmitButton>
      {state.error && (
        <p role="alert" className="text-sm font-semibold text-accent-text">
          {messages.errors[state.error]}
        </p>
      )}
      {state.awarded && (
        <p role="status" className="text-sm font-semibold text-success-text">
          {text.awarded(state.awarded.season, state.awarded.count, state.awarded.fresh)}
        </p>
      )}
    </form>
  );
}
