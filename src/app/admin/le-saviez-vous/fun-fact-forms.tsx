"use client";

import { useActionState } from "react";

import type { AdminFunFact } from "@/application/fun-facts";
import { messages } from "@/app/messages.fr";
import { SubmitButton } from "@/components/account/submit-button";
import {
  FUN_FACT_BODY_MAX_LENGTH,
  FUN_FACT_SOURCE_MAX_LENGTH,
  FUN_FACT_TAGS,
  FUN_FACT_TITLE_MAX_LENGTH,
} from "@/domain/fun-facts";

import {
  deleteFunFactAction,
  saveFunFactAction,
  setFunFactsEnabledAction,
  type FunFactState,
} from "./actions";

const text = messages.adminFunFacts;
const field = "min-h-11 w-full rounded-xl border-2 border-border bg-background px-3 text-base";
const label = "text-sm font-semibold";

function Outcome({ state, saved }: { state: FunFactState; saved: string }) {
  if (state.error) {
    return (
      <p role="alert" className="text-sm font-semibold text-accent-text">
        {messages.errors[state.error]}
      </p>
    );
  }
  return state.saved ? (
    <p role="status" className="text-sm font-semibold text-success-text">
      {saved}
    </p>
  ) : null;
}

/** The card on or off for every player (#766). */
export function EnabledForm({ enabled }: { enabled: boolean }) {
  const [state, action] = useActionState<FunFactState, FormData>(setFunFactsEnabledAction, {});
  return (
    <form action={action} className="flex flex-col gap-2">
      <p className="text-sm">{enabled ? text.on : text.off}</p>
      <input type="hidden" name="enabled" value={enabled ? "off" : "on"} />
      <SubmitButton pendingLabel={text.saving} variant={enabled ? "muted" : "default"}>
        {enabled ? text.switchOff : text.switchOn}
      </SubmitButton>
      <Outcome state={state} saved={text.switched} />
    </form>
  );
}

type Choices = { competitions: { slug: string; name: string }[]; disciplines: string[] };

/** Adds a fact, or edits one when `fact` is given. */
export function FunFactForm({ fact, ...choices }: { fact?: AdminFunFact } & Choices) {
  const [state, action] = useActionState<FunFactState, FormData>(saveFunFactAction, {});
  const id = fact?.id ?? "new";
  return (
    <form action={action} className="flex flex-col gap-2">
      {fact && <input type="hidden" name="id" value={fact.id} />}
      <label htmlFor={`title-${id}`} className={label}>
        {text.title}
      </label>
      <input
        id={`title-${id}`}
        name="title"
        required
        maxLength={FUN_FACT_TITLE_MAX_LENGTH}
        defaultValue={fact?.title}
        className={field}
      />
      <label htmlFor={`body-${id}`} className={label}>
        {text.body}
      </label>
      <textarea
        id={`body-${id}`}
        name="body"
        required
        rows={4}
        maxLength={FUN_FACT_BODY_MAX_LENGTH}
        defaultValue={fact?.body}
        className={`${field} py-2`}
      />
      <label htmlFor={`tag-${id}`} className={label}>
        {text.tag}
      </label>
      <select id={`tag-${id}`} name="tag" defaultValue={fact?.tag ?? "oddity"} className={field}>
        {FUN_FACT_TAGS.map((tag) => (
          <option key={tag} value={tag}>
            {messages.funFacts.tag[tag]}
          </option>
        ))}
      </select>
      <label htmlFor={`source-${id}`} className={label}>
        {text.source}
      </label>
      <input
        id={`source-${id}`}
        name="source"
        maxLength={FUN_FACT_SOURCE_MAX_LENGTH}
        defaultValue={fact?.source}
        className={field}
      />
      <fieldset className="flex flex-col gap-2 rounded-xl border border-border p-3">
        <legend className="px-1 text-sm font-semibold">{text.tie}</legend>
        <p className="text-xs text-muted-foreground">{text.tieHelp}</p>
        <label htmlFor={`competition-${id}`} className={label}>
          {text.competition}
        </label>
        <select
          id={`competition-${id}`}
          name="competition"
          defaultValue={fact?.competitionSlug ?? ""}
          className={field}
        >
          <option value="">{text.none}</option>
          {choices.competitions.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.name}
            </option>
          ))}
        </select>
        <label htmlFor={`discipline-${id}`} className={label}>
          {text.discipline}
        </label>
        <select
          id={`discipline-${id}`}
          name="discipline"
          defaultValue={fact?.discipline ?? ""}
          className={field}
        >
          <option value="">{text.none}</option>
          {choices.disciplines.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-1">
            <label htmlFor={`starts-${id}`} className={label}>
              {text.startsOn}
            </label>
            <input
              id={`starts-${id}`}
              type="date"
              name="startsOn"
              defaultValue={fact?.startsOn ?? ""}
              className={field}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor={`ends-${id}`} className={label}>
              {text.endsOn}
            </label>
            <input
              id={`ends-${id}`}
              type="date"
              name="endsOn"
              defaultValue={fact?.endsOn ?? ""}
              className={field}
            />
          </div>
        </div>
      </fieldset>
      <label className="flex min-h-11 items-center gap-2 text-sm font-semibold">
        <input
          type="checkbox"
          name="active"
          defaultChecked={fact?.active ?? true}
          className="size-5"
        />
        {text.active}
      </label>
      <SubmitButton pendingLabel={text.saving}>{fact ? text.save : text.add}</SubmitButton>
      <Outcome state={state} saved={fact ? text.saved : text.added} />
    </form>
  );
}

/** Deleting asks once more: a second button, under « Supprimer ». */
export function DeleteFunFactForm({ id, title }: { id: string; title: string }) {
  const [state, action] = useActionState<FunFactState, FormData>(deleteFunFactAction, {});
  return (
    <details className="rounded-xl border border-border p-2">
      <summary className="flex min-h-11 cursor-pointer items-center px-1 text-sm font-semibold">
        {text.delete}
      </summary>
      <form action={action} className="flex flex-col gap-2 pt-2">
        <input type="hidden" name="id" value={id} />
        <p className="text-sm">{text.confirmDelete}</p>
        <SubmitButton
          pendingLabel={text.deleting}
          variant="outline"
          ariaLabel={text.deleteOne(title)}
        >
          {text.confirm}
        </SubmitButton>
        <Outcome state={state} saved={text.deleted} />
      </form>
    </details>
  );
}
