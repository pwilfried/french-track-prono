"use client";

import { useActionState, useState } from "react";

import { messages } from "@/app/messages.fr";
import { SubmitButton } from "@/components/account/submit-button";
import { flagOf } from "@/domain/flag";
import { MAX_START_LIST, searchAthletes } from "@/domain/start-list";

import { saveStartListAction, type AdminActionState } from "../actions";

type Athlete = { athleteId: string; name: string; countryCode: string };
type Chosen = Athlete & { seasonBest: string };

/** How many matches the search shows at once: enough to pick, short enough to stay on screen. */
const SHOWN = 8;

/**
 * Builds a start list: search an athlete by name (accents and case ignored), add them, type their
 * season best, remove them. Adding an athlete twice shows a message and adds nothing.
 */
export function StartListForm({
  eventId,
  slug,
  candidates,
  initial,
}: {
  eventId: string;
  slug: string;
  candidates: Athlete[];
  initial: Chosen[];
}) {
  const [state, action] = useActionState<AdminActionState, FormData>(saveStartListAction, {});
  const [chosen, setChosen] = useState<Chosen[]>(initial);
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const matches = searchAthletes(candidates, query).slice(0, SHOWN);
  const full = chosen.length >= MAX_START_LIST;

  const add = (athlete: Athlete) => {
    if (chosen.some((c) => c.athleteId === athlete.athleteId)) {
      setNotice(messages.startList.duplicate(athlete.name));
      return;
    }
    if (full) {
      setNotice(messages.startList.full);
      return;
    }
    setNotice(null);
    setChosen([...chosen, { ...athlete, seasonBest: "" }]);
  };

  return (
    <form action={action} className="flex flex-col gap-4 px-4">
      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="slug" value={slug} />
      <input
        type="hidden"
        name="entries"
        value={JSON.stringify(
          chosen.map((c) => ({ athleteId: c.athleteId, seasonBest: c.seasonBest })),
        )}
      />

      <section aria-labelledby="chosen-title" className="flex flex-col gap-2">
        <h2
          id="chosen-title"
          className="flex items-baseline justify-between text-xs font-bold uppercase tracking-wider text-muted-foreground"
        >
          <span>{messages.startList.chosen}</span>
          <span className="font-mono">
            {messages.startList.count(chosen.length, MAX_START_LIST)}
          </span>
        </h2>
        {chosen.length === 0 ? (
          <p className="rounded-card bg-muted p-4 text-sm">{messages.startList.empty}</p>
        ) : (
          <ol className="flex flex-col gap-2">
            {chosen.map((c, index) => (
              <li
                key={c.athleteId}
                className="flex items-center gap-2 rounded-card border border-border bg-card p-2.5"
              >
                <span className="w-5 shrink-0 text-center font-mono text-sm text-muted-foreground">
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block break-words font-semibold">{c.name}</span>
                  <span className="block text-xs text-muted-foreground">
                    {flagOf(c.countryCode)} {c.countryCode}
                  </span>
                </span>
                <input
                  aria-label={messages.startList.seasonBest(c.name)}
                  placeholder={messages.startList.seasonBestPlaceholder}
                  value={c.seasonBest}
                  onChange={(e) =>
                    setChosen(
                      chosen.map((o) =>
                        o.athleteId === c.athleteId ? { ...o, seasonBest: e.target.value } : o,
                      ),
                    )
                  }
                  inputMode="decimal"
                  maxLength={12}
                  className="min-h-11 w-24 rounded-xl border-2 border-border bg-background px-2.5 font-mono text-base"
                />
                <button
                  type="button"
                  onClick={() => setChosen(chosen.filter((o) => o.athleteId !== c.athleteId))}
                  aria-label={messages.startList.remove(c.name)}
                  className="grid size-11 shrink-0 place-items-center rounded-full text-lg font-bold text-muted-foreground hover:bg-muted"
                >
                  ✕
                </button>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section aria-labelledby="search-title" className="flex flex-col gap-2">
        <h2
          id="search-title"
          className="text-xs font-bold uppercase tracking-wider text-muted-foreground"
        >
          {messages.startList.add}
        </h2>
        <label htmlFor="athlete-search" className="sr-only">
          {messages.startList.search}
        </label>
        <input
          id="athlete-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={messages.startList.search}
          autoComplete="off"
          className="min-h-12 rounded-xl border-2 border-border bg-card px-3.5 text-base"
        />
        {notice && (
          <p role="alert" className="text-sm font-semibold text-accent-text">
            {notice}
          </p>
        )}
        {matches.length === 0 ? (
          <p className="text-sm text-muted-foreground">{messages.startList.noMatch}</p>
        ) : (
          <ul aria-label={messages.startList.matches} className="flex flex-col">
            {matches.map((athlete) => {
              const on = chosen.some((c) => c.athleteId === athlete.athleteId);
              return (
                <li key={athlete.athleteId} className="border-b border-border">
                  <button
                    type="button"
                    onClick={() => add(athlete)}
                    className="flex min-h-12 w-full items-center gap-3 py-2 text-left"
                  >
                    <span aria-hidden className="text-lg">
                      {flagOf(athlete.countryCode)}
                    </span>
                    <span className="min-w-0 flex-1 break-words font-semibold">{athlete.name}</span>
                    <span
                      className={
                        on
                          ? "shrink-0 rounded-full bg-success/20 px-3 py-1.5 text-xs font-bold text-success-text"
                          : "shrink-0 rounded-full bg-brand-soft px-3 py-1.5 text-xs font-bold text-brand-ink"
                      }
                    >
                      {on ? messages.startList.alreadyIn : messages.startList.addOne}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {state.error && (
        <p role="alert" className="text-sm font-semibold text-accent-text">
          {messages.errors[state.error]}
        </p>
      )}
      <SubmitButton pendingLabel={messages.startList.saving}>
        {messages.startList.save}
      </SubmitButton>
    </form>
  );
}
