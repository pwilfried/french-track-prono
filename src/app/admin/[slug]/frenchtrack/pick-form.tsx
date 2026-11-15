"use client";

import { useActionState } from "react";

import { messages } from "@/app/messages.fr";
import { SubmitButton } from "@/components/account/submit-button";
import type { Podium } from "@/domain/podium-draft";

import { saveFrenchTrackPickAction, type AdminActionState } from "../actions";

const text = messages.challenge.admin;
const PLACES = [
  ["first", 1],
  ["second", 2],
  ["third", 3],
] as const;

/** FrenchTrack's podium: three athletes of the start list, then save; or remove the challenge. */
export function FrenchTrackPickForm({
  eventId,
  slug,
  startList,
  initial,
}: {
  eventId: string;
  slug: string;
  startList: { athleteId: string; name: string; countryCode: string }[];
  initial: Podium | null;
}) {
  const [state, action] = useActionState<AdminActionState, FormData>(saveFrenchTrackPickAction, {});
  return (
    <div className="flex flex-col gap-3">
      <form action={action} className="flex flex-col gap-3">
        <input type="hidden" name="eventId" value={eventId} />
        <input type="hidden" name="slug" value={slug} />
        {PLACES.map(([place, rank]) => (
          <label key={place} className="flex flex-col gap-1 text-sm font-bold">
            {text.place(rank)}
            <select
              name={place}
              required
              defaultValue={initial?.[place] ?? ""}
              className="min-h-11 w-full rounded-[10px] border-2 border-border bg-background px-2 text-[15px] font-semibold"
            >
              <option value="" disabled>
                {text.choose}
              </option>
              {startList.map((athlete) => (
                <option key={athlete.athleteId} value={athlete.athleteId}>
                  {athlete.name} ({athlete.countryCode})
                </option>
              ))}
            </select>
          </label>
        ))}
        {state.error && (
          <p role="alert" className="text-sm font-semibold text-accent-text">
            {messages.errors[state.error]}
          </p>
        )}
        <SubmitButton pendingLabel={text.saving}>{text.save}</SubmitButton>
      </form>
      {initial && (
        <form action={action}>
          <input type="hidden" name="eventId" value={eventId} />
          <input type="hidden" name="slug" value={slug} />
          <SubmitButton intent="remove" variant="outline" pendingLabel={text.removing}>
            {text.remove}
          </SubmitButton>
        </form>
      )}
    </div>
  );
}
