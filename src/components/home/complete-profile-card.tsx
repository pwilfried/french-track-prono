"use client";

import Link from "next/link";
import { useActionState, useState, useTransition } from "react";

import type { Club } from "@/application/clubs";
import type { ErrorCode } from "@/application/errors";
import { messages } from "@/app/messages.fr";
import { ClubPicker, type ClubPickerValue } from "@/components/account/club-picker";
import { SubmitButton } from "@/components/account/submit-button";
import { PROFILE_FAMILIES } from "@/domain/profile-reminder";
import { cn } from "@/lib/utils";

const text = messages.playerHome.completeProfile;

/** What the card holds, kept when the save fails. */
export type CompleteProfileState = ClubPickerValue & {
  families: string[];
  done?: boolean;
  error?: ErrorCode;
};

export const EMPTY_COMPLETE_PROFILE: CompleteProfileState = {
  club: null,
  newClubName: "",
  newClubCity: "",
  families: [],
};

const CLUB_ERRORS: ErrorCode[] = ["CLUB_NAME_INVALID", "CLUB_NAME_BANNED", "CLUB_UNKNOWN"];

/**
 * « Complète ton profil » (#540), under « Ta prochaine action » while the player has neither a club
 * nor a discipline: the club search and six families of disciplines. « Plus tard » hides it 30 days.
 */
export function CompleteProfileCard({
  firstPodium,
  initial = EMPTY_COMPLETE_PROFILE,
  search,
  save,
  later,
}: {
  /** Just after the first prediction: a green banner above the card. */
  firstPodium: boolean;
  initial?: CompleteProfileState;
  search: (query: string) => Promise<Club[]>;
  save: (state: CompleteProfileState, data: FormData) => Promise<CompleteProfileState>;
  later: () => Promise<void>;
}) {
  const [state, action] = useActionState(save, initial);
  const [hidden, setHidden] = useState(false);
  const [, startTransition] = useTransition();
  if (hidden || state.done) return null;

  const error = state.error ? messages.errors[state.error] : undefined;
  const clubError = state.error && CLUB_ERRORS.includes(state.error) ? error : undefined;

  return (
    <div className="flex flex-col gap-2.5">
      {firstPodium ? (
        <p
          role="status"
          className="rounded-2xl bg-success/15 px-3.5 py-3 text-sm font-bold text-success-text"
        >
          {text.firstPodium}
        </p>
      ) : null}
      <section
        aria-labelledby="complete-profile"
        className="flex flex-col gap-4 rounded-card border border-border bg-card/90 p-4 backdrop-blur-sm"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 flex-col gap-1">
            <h2
              id="complete-profile"
              className="font-display text-xl font-extrabold leading-tight break-words"
            >
              {text.title}
            </h2>
            <p className="text-sm text-muted-foreground">{text.text}</p>
          </div>
          <button
            type="button"
            aria-label={text.laterLabel}
            title={text.later}
            onClick={() => {
              setHidden(true);
              startTransition(() => later());
            }}
            className="-mt-2 -mr-2 inline-flex size-11 shrink-0 items-center justify-center rounded-full text-2xl leading-none text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring"
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>

        <form action={action} noValidate className="flex flex-col gap-4">
          <ClubPicker
            initial={{
              club: state.club,
              newClubName: state.newClubName,
              newClubCity: state.newClubCity,
            }}
            search={search}
            error={clubError}
          />
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-bold uppercase tracking-wide text-muted-foreground">
              {text.familiesLabel}
            </legend>
            <div className="flex flex-wrap gap-2">
              {PROFILE_FAMILIES.map(({ family }) => (
                <label key={family} className="cursor-pointer">
                  <input
                    type="checkbox"
                    name="family"
                    value={family}
                    defaultChecked={state.families.includes(family)}
                    className="peer sr-only"
                  />
                  <span
                    className={cn(
                      "inline-flex min-h-11 items-center rounded-full border-2 border-border bg-card px-4 text-sm font-semibold",
                      "peer-checked:border-primary peer-checked:bg-primary peer-checked:text-primary-foreground peer-focus-visible:ring-4 peer-focus-visible:ring-ring",
                    )}
                  >
                    {text.family[family]}
                  </span>
                </label>
              ))}
            </div>
            <Link
              href="/profil/modifier"
              className="inline-flex min-h-11 items-center self-start text-sm font-bold underline underline-offset-4"
            >
              {text.precise}
            </Link>
          </fieldset>
          {error && !clubError ? (
            <p role="alert" className="rounded-card bg-muted p-4 font-semibold">
              {error}
            </p>
          ) : null}
          <SubmitButton pendingLabel={text.saving}>{text.save}</SubmitButton>
        </form>
      </section>
    </div>
  );
}
