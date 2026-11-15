"use client";

import { Fragment, useState } from "react";

import { messages } from "@/app/messages.fr";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { buttonVariants } from "@/components/ui/button";
import type { DisciplineFamily } from "@/domain/discipline";
import {
  fitsPlace,
  lineupProgress,
  seatAthlete,
  type LineupPlace,
  type LineupStatus,
} from "@/domain/manager-lineup";
import type { ManagerSex } from "@/domain/manager-rules";
import { cn } from "@/lib/utils";

import { AthleteCard } from "./athlete-card";
import { EmptySpot, PlacedSpot, SpotSwatch, StadiumMap } from "./stadium";

const text = messages.lineup;

export type BoardAthlete = {
  athleteId: string;
  name: string;
  discipline: string;
  family: DisciplineFamily;
  sex: ManagerSex;
  paid: number;
  entered: boolean;
};

const SPOT_BUTTON =
  "block w-full rounded-lg focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring";

/**
 * The lineup of a Manager team before a competition (#427), on the stadium seen from above (#775):
 * one spot per place, each of a family or free (the rules of the league), at its place on the
 * track or the field. Tap a spot: a sheet lists only the athletes of the team who can go there
 * (entered, of its family; #937), or says none can; pick one and the stadium changes at
 * once (an athlete already placed elsewhere swaps with whoever sat there when they fit). The
 * athletes not lined up wait on the bench below. « Valider mon alignement » turns on once every
 * place the team can fill is filled (#839: the bar says how many stay empty and why; with no
 * athlete entered, it says so and offers nothing to validate; with no athlete at all, the bench
 * says so). Validated: a banner, still editable until the lock. Locked:
 * read only.
 */
export function LineupBoard({
  places,
  fillable,
  athletes,
  initial,
  status,
  error,
  onValidate,
}: {
  places: LineupPlace[];
  fillable: boolean[];
  athletes: BoardAthlete[];
  initial: (string | null)[];
  status: LineupStatus;
  error?: string;
  /** Saves the lineup; true once it is validated. */
  onValidate?: (athleteIds: string[]) => Promise<boolean>;
}) {
  const [placed, setPlaced] = useState(initial);
  const [open, setOpen] = useState<number | null>(null);
  const [changed, setChanged] = useState(false);
  const [saving, setSaving] = useState(false);
  // Saved from this screen: the banner shows at once, before the page brings its new status (#874).
  const [saved, setSaved] = useState(false);
  const editable = status !== "locked" && onValidate !== undefined;
  const byId = new Map(athletes.map((a) => [a.athleteId, a]));

  const update = (next: (string | null)[]) => {
    if (next !== placed) {
      setPlaced(next);
      setChanged(true);
    }
    setOpen(null);
  };

  const progress = lineupProgress(places, athletes, placed);
  const nobodyEntered = !athletes.some((a) => a.entered);
  const bench = athletes
    .filter((a) => !placed.includes(a.athleteId))
    .sort((a, b) => Number(b.entered) - Number(a.entered));
  // Only athletes entered in the competition make the lineup: one withdrawn since stays on the
  // stadium until moved, but is not sent.
  const lineup = placed.filter((id): id is string => id !== null && byId.get(id)?.entered === true);

  const spots = places.map((place, i) => {
    const athlete = placed[i] ? byId.get(placed[i]!) : undefined;
    const label = text.place[place];
    const visual = athlete ? (
      <PlacedSpot
        athlete={athlete}
        label={
          editable
            ? undefined
            : messages.team.cardLabel(athlete.name, athlete.discipline, athlete.paid)
        }
      />
    ) : (
      <EmptySpot label={label} fillable={fillable[i] === true} />
    );
    if (!editable) {
      return (
        <Fragment key={i}>
          {visual}
          <span className="sr-only">
            {athlete
              ? text.lockedPlace(label, athlete.name)
              : fillable[i]
                ? text.emptyPlace(label)
                : text.unfillablePlace(label)}
          </span>
        </Fragment>
      );
    }
    return (
      <button
        key={i}
        type="button"
        aria-label={
          athlete
            ? text.takenPlace(label, athlete.name)
            : fillable[i]
              ? text.emptyPlace(label)
              : text.unfillablePlace(label)
        }
        aria-haspopup="dialog"
        onClick={() => setOpen(i)}
        className={SPOT_BUTTON}
      >
        {visual}
      </button>
    );
  });

  const sheetPlace = open === null ? undefined : places[open];
  const sheetLabel = sheetPlace ? text.place[sheetPlace] : "";
  // Only the athletes who can take the place are listed (#937): entered and of its family.
  const choices =
    open === null || sheetPlace === undefined
      ? []
      : athletes
          .filter((a) => a.entered && fitsPlace(sheetPlace, a.family))
          .map((a) => ({ athlete: a, at: placed.indexOf(a.athleteId) }));

  return (
    <div className="flex flex-col gap-4">
      {status === "locked" ? (
        <p role="status" className="rounded-2xl bg-muted px-3.5 py-3 text-sm font-semibold">
          🔒 {text.locked}
        </p>
      ) : (
        (status === "validated" || saved) &&
        !changed && (
          <p
            role="status"
            className="rounded-2xl bg-success-soft px-3.5 py-3 text-sm font-semibold text-success-ink"
          >
            ✓ {text.validated}
          </p>
        )
      )}

      <section aria-labelledby="stadium" className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-2">
          <h2
            id="stadium"
            className="text-xs font-bold uppercase tracking-wide text-muted-foreground"
          >
            {text.stadium}
          </h2>
          <span className="font-mono text-sm font-extrabold tabular-nums">
            {text.places(progress.filled, places.length)}
          </span>
        </div>
        {editable && !nobodyEntered && <p className="text-sm text-muted-foreground">{text.hint}</p>}
        <StadiumMap label={text.stadium} places={places} spots={spots} />
      </section>

      <BottomSheet
        open={open !== null}
        onClose={() => setOpen(null)}
        title={text.sheetTitle(sheetLabel)}
      >
        <p className="mb-3 text-sm text-muted-foreground">{text.sheetHint(sheetLabel)}</p>
        {open !== null && placed[open] !== null && (
          <button
            type="button"
            onClick={() => update(placed.map((id, i) => (i === open ? null : id)))}
            className={cn(buttonVariants({ variant: "outline" }), "mb-3 w-full")}
          >
            {text.remove}
          </button>
        )}
        {choices.length === 0 ? (
          <p className="rounded-card bg-muted p-3 text-sm">{text.noEligible}</p>
        ) : (
          <ul aria-label={text.choices} className="flex flex-col gap-2">
            {choices.map(({ athlete: a, at }) => {
              const here = open !== null && at === open;
              const note = here
                ? text.onThisPlace
                : at >= 0
                  ? text.elsewhere(text.place[places[at]!])
                  : null;
              return (
                <li key={a.athleteId}>
                  <button
                    type="button"
                    disabled={here}
                    onClick={() =>
                      open !== null &&
                      update(seatAthlete(places, athletes, placed, a.athleteId, open))
                    }
                    className={cn(
                      "flex min-h-14 w-full items-center gap-3 rounded-2xl border border-border px-3 py-2 text-left",
                      "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring",
                      !here && "hover:bg-muted",
                      here && "border-2 border-primary",
                    )}
                  >
                    <SpotSwatch family={a.family} />
                    <span className="min-w-0 flex-1">
                      <span className="block break-words font-bold">{a.name}</span>
                      <span className="block text-sm text-muted-foreground">
                        {a.discipline} {messages.catalogue.sexShort[a.sex]}
                      </span>
                      {note && <span className="block text-xs font-semibold">{note}</span>}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </BottomSheet>

      <section aria-labelledby="bench" className="flex flex-col gap-2">
        <h2 id="bench" className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
          {text.bench}
        </h2>
        {bench.length === 0 ? (
          <p className="rounded-card bg-muted p-4 text-sm text-muted-foreground">
            {athletes.length === 0 ? text.noTeam : text.benchEmpty}
          </p>
        ) : (
          <ul
            aria-labelledby="bench"
            className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6"
          >
            {bench.map((a) => (
              <li key={a.athleteId}>
                <AthleteCard athlete={a} paid={a.paid} state={a.entered ? "normal" : "absent"} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {editable && athletes.length > 0 && (
        <div className="sticky bottom-20 flex flex-col gap-2 rounded-2xl bg-foreground p-3 text-background shadow-lg md:bottom-3">
          {nobodyEntered ? (
            <p className="text-sm font-semibold" aria-live="polite">
              {text.nobodyEntered}
            </p>
          ) : (
            <div className="flex flex-col gap-1" aria-live="polite">
              <p className="text-sm font-semibold">
                {progress.toFill.length > 0
                  ? text.toFill(
                      progress.toFill.map(({ place, count }) => ({
                        label: text.place[place],
                        count,
                      })),
                    )
                  : progress.unfillable > 0
                    ? text.fullOfEntered
                    : text.full}
              </p>
              {progress.unfillable > 0 && (
                <p className="text-sm">{text.unfillable(progress.unfillable)}</p>
              )}
            </div>
          )}
          {error && (
            <p role="alert" className="text-sm font-semibold text-secondary">
              {error}
            </p>
          )}
          {!nobodyEntered && (
            <button
              type="button"
              disabled={!progress.ready || saving}
              onClick={async () => {
                setSaving(true);
                const ok = await onValidate(lineup);
                setSaving(false);
                if (ok) {
                  setSaved(true);
                  setChanged(false);
                }
              }}
              className={cn(buttonVariants(), "w-full")}
            >
              {saving ? text.validating : text.validate}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
