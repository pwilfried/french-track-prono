"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useState, useTransition } from "react";

import type { Club } from "@/application/clubs";
import type { ErrorCode } from "@/application/errors";
import { messages } from "@/app/messages.fr";
import { ClubPicker, type ClubPickerValue } from "@/components/account/club-picker";
import { SubmitButton } from "@/components/account/submit-button";
import { Animal } from "@/components/band/animal";
import { Bib } from "@/components/profile/bib";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { buttonVariants } from "@/components/ui/button";
import type { Bib as BibValue } from "@/domain/bib";
import { PROFILE_FAMILIES, profileFamilyAnimal } from "@/domain/profile-reminder";
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

/** The club's name as the picker holds it: the one picked, else the one typed. */
function clubNameOf(state: ClubPickerValue): string {
  return state.club?.name ?? state.newClubName;
}

/**
 * « Complète ton profil » (#540, #801, #889), under « Ta prochaine action » while the player has
 * neither a club nor a discipline: a compact card whose « Compléter » opens a sheet in two steps.
 * « Mon club » prints the club on the player's bib as it is chosen; « Mes épreuves » lights the
 * animals of the band, one per family. Both steps sit in one form, so « Retour » and closing the
 * sheet keep what was chosen. « Plus tard » hides the card for 30 days.
 */
export function CompleteProfileCard({
  firstPodium,
  bib,
  pseudo,
  initial = EMPTY_COMPLETE_PROFILE,
  search,
  save,
  later,
}: {
  /** Just after the first prediction: a green banner above the card. */
  firstPodium: boolean;
  bib: BibValue;
  pseudo: string;
  initial?: CompleteProfileState;
  search: (query: string) => Promise<Club[]>;
  save: (state: CompleteProfileState, data: FormData) => Promise<CompleteProfileState>;
  later: () => Promise<void>;
}) {
  const [state, action] = useActionState(save, initial);
  const [hidden, setHidden] = useState(false);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [clubName, setClubName] = useState(clubNameOf(initial));
  const [answered, setAnswered] = useState(state);
  const [, startTransition] = useTransition();
  const router = useRouter();

  const error = state.error ? messages.errors[state.error] : undefined;
  const clubError = state.error && CLUB_ERRORS.includes(state.error) ? error : undefined;
  // A new answer from the server: a club error takes the player back to the club step.
  if (answered !== state) {
    setAnswered(state);
    if (clubError) setStep(1);
  }

  const putOff = () => {
    setHidden(true);
    setOpen(false);
    startTransition(() => later());
  };
  // Once saved, closing the confirmation refreshes the home, which no longer asks (#889).
  const close = () => {
    setOpen(false);
    if (state.done) router.refresh();
  };
  if (hidden || (state.done && !open)) return null;

  const laterButton = (
    <button
      type="button"
      onClick={putOff}
      aria-label={text.laterLabel}
      className={cn(buttonVariants({ variant: "muted" }), "w-full")}
    >
      {text.later}
    </button>
  );

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
      {state.done ? null : (
        <section
          aria-labelledby="complete-profile"
          className="flex items-center gap-2 rounded-card border border-border bg-card/90 py-2 pr-2 pl-4 backdrop-blur-sm"
        >
          <h2
            id="complete-profile"
            className="min-w-0 flex-1 font-display text-lg font-extrabold leading-tight break-words"
          >
            {text.title}
          </h2>
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={open}
            className={cn(buttonVariants(), "shrink-0 px-4 text-sm")}
          >
            {text.open}
          </button>
          <button
            type="button"
            aria-label={text.laterLabel}
            title={text.later}
            onClick={putOff}
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-full text-2xl leading-none text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring"
          >
            <span aria-hidden="true">×</span>
          </button>
        </section>
      )}
      <BottomSheet open={open} onClose={close} title={text.title}>
        {state.done ? (
          <div className="flex flex-col items-center gap-4 pb-2">
            <Bib bib={bib} size="large" pseudo={pseudo} club={clubName || undefined} />
            <p
              role="status"
              className="w-full rounded-2xl bg-success/15 px-3.5 py-3 text-center text-sm font-bold text-success-text"
            >
              {text.done}
            </p>
          </div>
        ) : (
          <form action={action} noValidate className="flex flex-col gap-4">
            <section
              aria-labelledby="complete-profile-club"
              hidden={step !== 1}
              className="flex flex-col gap-4"
            >
              <StepTitle id="complete-profile-club" n={1} title={text.clubTitle} />
              <p className="text-sm text-muted-foreground">{text.clubText}</p>
              <div className="flex justify-center">
                <Bib bib={bib} size="large" pseudo={pseudo} club={clubName || undefined} />
              </div>
              <ClubPicker
                initial={{
                  club: state.club,
                  newClubName: state.newClubName,
                  newClubCity: state.newClubCity,
                }}
                search={search}
                error={clubError}
                onClubName={setClubName}
              />
              <button
                type="button"
                onClick={() => setStep(2)}
                className={cn(buttonVariants(), "w-full")}
              >
                {text.next}
              </button>
              {laterButton}
            </section>
            <section
              aria-labelledby="complete-profile-families"
              hidden={step !== 2}
              className="flex flex-col gap-4"
            >
              <StepTitle id="complete-profile-families" n={2} title={text.familiesTitle} />
              <fieldset className="flex flex-col gap-3">
                <legend className="mb-3 text-sm text-muted-foreground">{text.familiesText}</legend>
                <div className="grid grid-cols-2 gap-2 min-[360px]:grid-cols-3">
                  {PROFILE_FAMILIES.map(({ family }) => {
                    const animal = profileFamilyAnimal(family);
                    return (
                      <label key={family} className="group cursor-pointer">
                        <input
                          type="checkbox"
                          name="family"
                          value={family}
                          defaultChecked={state.families.includes(family)}
                          className="peer sr-only"
                        />
                        <span
                          data-family-tile
                          className={cn(
                            "relative flex min-h-11 flex-col items-center gap-1 rounded-2xl border-2 border-border bg-card px-1.5 py-2 text-center",
                            "motion-safe:transition-colors motion-safe:duration-150",
                            "peer-checked:border-primary peer-checked:bg-primary/10 peer-focus-visible:ring-4 peer-focus-visible:ring-ring",
                            "[&>svg]:opacity-45 [&>svg]:grayscale peer-checked:[&>svg]:opacity-100 peer-checked:[&>svg]:grayscale-0",
                            "motion-safe:[&>svg]:transition motion-safe:[&>svg]:duration-200",
                          )}
                        >
                          <span
                            aria-hidden="true"
                            className="absolute top-1 right-1 hidden size-5 items-center justify-center rounded-full bg-primary text-xs font-extrabold text-primary-foreground group-has-[:checked]:flex"
                          >
                            ✓
                          </span>
                          <Animal kind={animal} size="medium" />
                          <span className="font-display text-sm font-extrabold leading-tight break-words">
                            {messages.band.animals[animal]}
                          </span>
                          <span className="text-xs leading-tight text-muted-foreground break-words">
                            {text.family[family]}
                          </span>
                        </span>
                      </label>
                    );
                  })}
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
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className={cn(buttonVariants({ variant: "outline" }), "w-full")}
                >
                  {text.back}
                </button>
                {laterButton}
              </div>
            </section>
          </form>
        )}
      </BottomSheet>
    </div>
  );
}

function StepTitle({ id, n, title }: { id: string; n: 1 | 2; title: string }) {
  return (
    <h3 id={id} className="flex flex-col">
      <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
        {text.step(n)}
      </span>
      <span className="font-display text-lg font-extrabold">{title}</span>
    </h3>
  );
}
