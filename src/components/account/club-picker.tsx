"use client";

import { useEffect, useId, useState } from "react";

import type { Club } from "@/application/clubs";
import { messages } from "@/app/messages.fr";
import { SEARCH_MAX_LENGTH } from "@/domain/list-view";

import { Field } from "./field";

const text = messages.clubPicker;

export type ClubPickerValue = {
  club: Pick<Club, "id" | "name" | "city"> | null;
  newClubName: string;
  newClubCity: string;
};

/**
 * Finds the player's club as they type (accents and case ignored), or lets them type it when it
 * is missing (#340). Sends `clubId`, `newClubName` and `newClubCity` with the form.
 */
export function ClubPicker({
  initial,
  search,
  error,
}: {
  initial: ClubPickerValue;
  search: (query: string) => Promise<Club[]>;
  error?: string;
}) {
  const id = useId();
  const [club, setClub] = useState(initial.club);
  const [typing, setTyping] = useState(initial.newClubName !== "");
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<Club[] | null>(null);

  useEffect(() => {
    if (club || typing || query.trim().length < 2) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      const clubs = await search(query);
      if (!cancelled) setFound(clubs);
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, club, typing, search]);

  const shown = query.trim().length >= 2 ? found : null;

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
        {text.legend}
      </legend>
      <input type="hidden" name="clubId" value={typing ? "" : (club?.id ?? "")} />
      <input type="hidden" name="clubName" value={club?.name ?? ""} />
      <input type="hidden" name="clubCity" value={club?.city ?? ""} />

      {typing ? (
        <div className="flex flex-col gap-3">
          <Field
            id={`${id}-name`}
            name="newClubName"
            label={text.newNameLabel}
            hint={text.newNameHint}
            defaultValue={initial.newClubName}
            error={error}
            maxLength={120}
          />
          <Field
            id={`${id}-city`}
            name="newClubCity"
            label={text.newCityLabel}
            defaultValue={initial.newClubCity}
            maxLength={80}
          />
          <button
            type="button"
            onClick={() => setTyping(false)}
            className="min-h-11 self-start font-semibold text-primary underline underline-offset-4"
          >
            {text.backToSearch}
          </button>
        </div>
      ) : club ? (
        <div className="flex min-h-12 items-center justify-between gap-3 rounded-2xl border-2 border-primary bg-muted px-3.5 py-2">
          <span>
            <span className="block font-bold">{club.name}</span>
            {club.city ? (
              <span className="block text-sm text-muted-foreground">{club.city}</span>
            ) : null}
          </span>
          <button
            type="button"
            onClick={() => {
              setClub(null);
              setQuery("");
              setFound(null);
            }}
            className="min-h-11 shrink-0 font-semibold text-primary underline underline-offset-4"
          >
            {text.change}
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <Field
            id={`${id}-search`}
            type="search"
            label={text.searchLabel}
            hint={text.searchHint}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            maxLength={SEARCH_MAX_LENGTH}
            autoComplete="off"
            error={error}
          />
          {shown ? (
            shown.length > 0 ? (
              <ul aria-label={text.results} className="flex flex-col gap-1.5">
                {shown.map((option) => (
                  <li key={option.id}>
                    <button
                      type="button"
                      onClick={() => setClub(option)}
                      className="flex min-h-12 w-full flex-col items-start rounded-2xl border-2 border-border bg-card px-3.5 py-2 text-left hover:border-primary focus-visible:border-primary focus-visible:outline-none"
                    >
                      <span className="font-bold">{option.name}</span>
                      {option.city ? (
                        <span className="text-sm text-muted-foreground">{option.city}</span>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground" role="status">
                {text.none}
              </p>
            )
          ) : null}
          <button
            type="button"
            onClick={() => setTyping(true)}
            className="min-h-11 self-start font-semibold text-primary underline underline-offset-4"
          >
            {text.missing}
          </button>
        </div>
      )}
    </fieldset>
  );
}
