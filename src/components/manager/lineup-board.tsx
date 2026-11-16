"use client";

import { Fragment, useRef, useState } from "react";

import { messages } from "@/app/messages.fr";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { buttonVariants } from "@/components/ui/button";
import type { DisciplineFamily } from "@/domain/discipline";
import { formatMark } from "@/domain/discipline";
import {
  benchRole,
  designateSubstitute,
  addToBench,
  matchSheetOf,
  moveOnBench,
  removeFromBench,
  tacticalCount,
  thresholdSense,
  type BenchPlan,
} from "@/domain/manager-bench";
import {
  fitsPlace,
  lineupProgress,
  seatAthlete,
  sheetDiscipline,
  type LineupDiscipline,
  type LineupPlace,
  type LineupStatus,
  type MatchSheet,
} from "@/domain/manager-lineup";
import { managerFamilyOf, type ManagerSex } from "@/domain/manager-rules";
import { shortAthleteName } from "@/domain/manager-team";
import { cn } from "@/lib/utils";

import {
  PlaceSettings,
  readThreshold,
  type PlaceDraft,
  type SubstituteChoice,
} from "./place-settings";
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
  /** Where they may count in the competition, the first one first (#1035). */
  disciplines?: LineupDiscipline[];
  pb?: string | null;
  sb?: string | null;
};

const EMPTY_PLAN: BenchPlan = { bench: [], settings: {} };

const SPOT_BUTTON =
  "block w-full rounded-lg focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring";

const SECTION_TITLE = "text-xs font-bold uppercase tracking-wide text-muted-foreground";
const SMALL_BUTTON =
  "inline-flex size-11 shrink-0 items-center justify-center rounded-full border border-border text-base font-bold hover:bg-muted disabled:opacity-40 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring";

/** Where an athlete counts: the discipline chosen, else their first one, else their main one. */
function countsIn(a: BoardAthlete, chosen: string | undefined): LineupDiscipline | null {
  return sheetDiscipline({ disciplines: a.disciplines ?? [] }, chosen);
}

/** A mark as a player types it: a comma, no unit. */
const typedMark = (value: number, unit: LineupDiscipline["unit"]) =>
  formatMark(value, unit).replace(".", ",");

/**
 * The match sheet of a Manager team before a competition (#427, #1035), on the stadium seen from
 * above (#775): one spot per place, two per family, each with the discipline that counts, and
 * under the name « ↻ » the designated substitute and « ⏱ » the tactical threshold. Tap an empty
 * spot: a sheet lists the athletes of the team who can go there (entered, of its family; #937).
 * Tap a filled one: the sheet sets the place (discipline, substitute, tactical replacement; the
 * draft is kept when it closes, « Enregistrer » applies it) and still lets the player change the
 * starter. Under the stadium, the substitutes in the order they come in (handle, or buttons up and
 * down), then the reserve, folded: those who do not play this competition. The bar sums it all
 * up, says what stays to fill (#839) and holds « Valider mon alignement ». Validated: a banner,
 * still editable until the lock. Locked: read only.
 */
export function LineupBoard({
  places,
  fillable,
  athletes,
  initial,
  initialPlan = EMPTY_PLAN,
  benchSize = 0,
  divisor = 10,
  status,
  error,
  onValidate,
}: {
  places: LineupPlace[];
  fillable: boolean[];
  athletes: BoardAthlete[];
  initial: (string | null)[];
  /** The saved bench and the settings of each starter. */
  initialPlan?: BenchPlan;
  /** How many substitutes the bench holds (the rules of the league). */
  benchSize?: number;
  /** Table points are divided by it (#1031): the threshold says what it is worth. */
  divisor?: number;
  status: LineupStatus;
  error?: string;
  /** Saves the match sheet; true once it is validated. */
  onValidate?: (sheet: MatchSheet) => Promise<boolean>;
}) {
  const [placed, setPlaced] = useState(initial);
  const [plan, setPlan] = useState(initialPlan);
  const [drafts, setDrafts] = useState<Record<string, PlaceDraft>>({});
  const [open, setOpen] = useState<number | null>(null);
  const [changed, setChanged] = useState(false);
  const [saving, setSaving] = useState(false);
  // Saved from this screen: the banner shows at once, before the page brings its new status (#874).
  const [saved, setSaved] = useState(false);
  const dragging = useRef<number | null>(null);
  const editable = status !== "locked" && onValidate !== undefined;
  const byId = new Map(athletes.map((a) => [a.athleteId, a]));

  const changePlan = (next: BenchPlan) => {
    if (next === plan) return;
    setPlan(next);
    setChanged(true);
  };

  const update = (next: (string | null)[]) => {
    if (next !== placed) {
      // Whoever lands on the stadium leaves the bench.
      setPlan(next.reduce((p, id) => (id ? removeFromBench(p, id) : p), plan));
      setPlaced(next);
      setChanged(true);
    }
    setOpen(null);
  };

  const progress = lineupProgress(places, athletes, placed);
  const nobodyEntered = !athletes.some((a) => a.entered);
  const isEntered = (id: string | null) => id !== null && byId.get(id)?.entered === true;
  // Only athletes entered in the competition make the sheet: one withdrawn since stays where they
  // are until moved, but is not sent.
  const sentPlaced = placed.map((id) => (isEntered(id) ? id : null));
  const starters = sentPlaced.filter((id): id is string => id !== null);
  const bench = plan.bench.flatMap((id) => {
    const a = byId.get(id);
    return a ? [a] : [];
  });
  const sentPlan = { ...plan, bench: plan.bench.filter(isEntered) };
  const benchFull = plan.bench.length >= benchSize;
  const reserve = athletes
    .filter((a) => !placed.includes(a.athleteId) && !plan.bench.includes(a.athleteId))
    .sort((a, b) => Number(b.entered) - Number(a.entered));

  /** The tactical threshold of a starter as it will be sent, written for the screen. */
  const thresholdOf = (starterId: string) => {
    const s = plan.settings[starterId];
    const a = byId.get(starterId);
    if (!a || s?.threshold == null || !s.substituteId || !sentPlan.bench.includes(s.substituteId)) {
      return null;
    }
    const d = countsIn(a, s.discipline);
    return d
      ? { label: messages.picker.rangeMark(s.threshold, d.unit), sense: thresholdSense(d.family) }
      : null;
  };

  const spots = places.map((place, i) => {
    const athlete = placed[i] ? byId.get(placed[i]!) : undefined;
    const label = text.place[place];
    const setting = athlete ? plan.settings[athlete.athleteId] : undefined;
    const substitute =
      setting?.substituteId && plan.bench.includes(setting.substituteId)
        ? byId.get(setting.substituteId)
        : undefined;
    const shown = athlete && {
      ...athlete,
      discipline: countsIn(athlete, setting?.discipline)?.name ?? athlete.discipline,
    };
    const note = athlete
      ? text.spotNote(
          substitute ? shortAthleteName(substitute.name) : null,
          substitute ? (thresholdOf(athlete.athleteId)?.label ?? null) : null,
        )
      : "";
    const visual = shown ? (
      <PlacedSpot
        athlete={shown}
        note={note || undefined}
        label={
          editable ? undefined : messages.team.cardLabel(shown.name, shown.discipline, shown.paid)
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
  const starter = open !== null && placed[open] ? byId.get(placed[open]!) : undefined;
  // Only the athletes who can take the place are listed (#937): entered and of its family.
  const choices =
    open === null || sheetPlace === undefined
      ? []
      : athletes
          .filter((a) => a.entered && fitsPlace(sheetPlace, a.family))
          .map((a) => ({ athlete: a, at: placed.indexOf(a.athleteId) }));

  const draftOf = (a: BoardAthlete): PlaceDraft => {
    const kept = drafts[a.athleteId];
    if (kept) return kept;
    const s = plan.settings[a.athleteId] ?? {};
    const substituteId =
      s.substituteId != null && plan.bench.includes(s.substituteId) ? s.substituteId : null;
    const d = countsIn(a, s.discipline);
    return {
      discipline: s.discipline,
      substituteId,
      thresholdOn: substituteId !== null && s.threshold != null,
      thresholdText: s.threshold != null && d ? typedMark(s.threshold, d.unit) : "",
      checked: false,
    };
  };
  const draft = starter ? draftOf(starter) : undefined;
  const setDraft = (a: BoardAthlete, next: PlaceDraft) =>
    setDrafts((all) => ({ ...all, [a.athleteId]: next }));

  const substitutesFor = (a: BoardAthlete): SubstituteChoice[] => {
    const family = managerFamilyOf(a.family);
    const designatedFor = (id: string) =>
      starters.find((s) => s !== a.athleteId && plan.settings[s]?.substituteId === id);
    return athletes
      .filter(
        (b) =>
          b.entered &&
          !placed.includes(b.athleteId) &&
          family !== null &&
          managerFamilyOf(b.family) === family,
      )
      .map((b) => ({ b, rank: plan.bench.indexOf(b.athleteId) }))
      .sort((x, y) => (x.rank < 0 ? 99 : x.rank) - (y.rank < 0 ? 99 : y.rank))
      .map(({ b, rank }) => {
        const other = rank >= 0 ? designatedFor(b.athleteId) : undefined;
        return {
          athleteId: b.athleteId,
          name: b.name,
          discipline: countsIn(b, undefined)?.name ?? b.discipline,
          note:
            rank < 0
              ? benchFull
                ? text.benchFull
                : text.candidateInReserve
              : other
                ? text.candidateFor(byId.get(other)!.name)
                : text.candidateOnBench(rank + 1),
          disabled: rank < 0 && benchFull,
        };
      });
  };

  const savePlace = (a: BoardAthlete, d: PlaceDraft) => {
    const discipline = countsIn(a, d.discipline);
    let threshold: number | null = null;
    if (d.thresholdOn && d.substituteId !== null && discipline) {
      const read = readThreshold(d, discipline);
      if (typeof read !== "number") {
        setDraft(a, { ...d, checked: true });
        return;
      }
      threshold = read;
    }
    const next = designateSubstitute(plan, a.athleteId, d.substituteId, benchSize);
    const own = next.settings[a.athleteId] ?? {};
    changePlan({
      ...next,
      settings: {
        ...next.settings,
        [a.athleteId]: {
          ...own,
          ...(d.discipline !== undefined && { discipline: d.discipline }),
          threshold: own.substituteId ? threshold : null,
        },
      },
    });
    setDrafts((all) => {
      const rest = { ...all };
      delete rest[a.athleteId];
      return rest;
    });
    setOpen(null);
  };

  const benchLine = (a: BoardAthlete) => {
    const role = benchRole(sentPlan, starters, a.athleteId);
    if (role.kind === "bench") return text.role(role);
    const name = byId.get(role.starterId)?.name ?? "";
    if (role.kind === "absent") return text.role({ kind: "absent", starter: name });
    const threshold = thresholdOf(role.starterId);
    return threshold
      ? text.role({
          kind: "threshold",
          starter: name,
          threshold: threshold.label,
          sense: threshold.sense,
        })
      : text.role({ kind: "absent", starter: name });
  };

  const tactical = tacticalCount(starters, sentPlan);

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
          <h2 id="stadium" className={SECTION_TITLE}>
            {text.stadium}
          </h2>
          <span
            aria-label={text.placesLabel(progress.filled, places.length)}
            className="font-mono text-sm font-extrabold tabular-nums"
          >
            {text.places(progress.filled, places.length)}
          </span>
        </div>
        <StadiumMap label={text.stadium} places={places} spots={spots} />
        {editable && !nobodyEntered && (
          <p className="text-sm text-muted-foreground">{text.legend}</p>
        )}
      </section>

      {athletes.length === 0 ? (
        <p className="rounded-card bg-muted p-4 text-sm text-muted-foreground">{text.noTeam}</p>
      ) : (
        <>
          <section aria-labelledby="bench" className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between gap-2">
              <h2 id="bench" className={SECTION_TITLE}>
                {text.bench}
              </h2>
              {benchSize > 0 && (
                <span className="font-mono text-sm font-extrabold tabular-nums">
                  {text.benchCount(bench.length, benchSize)}
                </span>
              )}
            </div>
            {benchSize === 0 ? (
              <p className="rounded-card bg-muted p-4 text-sm text-muted-foreground">
                {text.noBench}
              </p>
            ) : bench.length === 0 ? (
              <p className="rounded-card bg-muted p-4 text-sm text-muted-foreground">
                {text.benchEmpty}
              </p>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">{text.benchOrder}</p>
                <ol aria-labelledby="bench" className="flex flex-col gap-2">
                  {bench.map((a, k) => (
                    <li
                      key={a.athleteId}
                      data-bench-index={k}
                      className={cn(
                        "flex items-center gap-2 rounded-2xl border border-border p-2",
                        !a.entered && "opacity-60",
                      )}
                    >
                      {editable && (
                        <span
                          aria-hidden
                          onPointerDown={(event) => {
                            dragging.current = k;
                            event.currentTarget.setPointerCapture?.(event.pointerId);
                          }}
                          onPointerMove={(event) => {
                            const from = dragging.current;
                            if (from === null) return;
                            const row = document
                              .elementFromPoint(event.clientX, event.clientY)
                              ?.closest<HTMLElement>("[data-bench-index]");
                            const to = row ? Number(row.dataset.benchIndex) : NaN;
                            if (!Number.isInteger(to) || to === from) return;
                            dragging.current = to;
                            setPlan((p) => moveOnBench(p, from, to));
                            setChanged(true);
                          }}
                          onPointerUp={() => (dragging.current = null)}
                          onPointerCancel={() => (dragging.current = null)}
                          className="flex h-11 w-6 shrink-0 cursor-grab touch-none items-center justify-center text-lg text-muted-foreground"
                        >
                          ≡
                        </span>
                      )}
                      <span
                        aria-label={text.rank(k + 1)}
                        className="grid size-8 shrink-0 place-items-center rounded-full bg-brand font-mono font-extrabold text-[var(--medal-gold-from)]"
                      >
                        {k + 1}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block break-words text-sm font-bold">
                          {a.name} · {countsIn(a, undefined)?.name ?? a.discipline}
                        </span>
                        <span className="block text-xs font-semibold text-muted-foreground">
                          {a.entered ? benchLine(a) : messages.team.absent}
                        </span>
                      </span>
                      {editable && (
                        <span className="flex shrink-0 gap-1">
                          <button
                            type="button"
                            aria-label={text.moveUp(a.name)}
                            disabled={k === 0}
                            onClick={() => changePlan(moveOnBench(plan, k, k - 1))}
                            className={SMALL_BUTTON}
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            aria-label={text.moveDown(a.name)}
                            disabled={k === bench.length - 1}
                            onClick={() => changePlan(moveOnBench(plan, k, k + 1))}
                            className={SMALL_BUTTON}
                          >
                            ↓
                          </button>
                          <button
                            type="button"
                            aria-label={text.toReserve(a.name)}
                            onClick={() => changePlan(removeFromBench(plan, a.athleteId))}
                            className={SMALL_BUTTON}
                          >
                            ×
                          </button>
                        </span>
                      )}
                    </li>
                  ))}
                </ol>
              </>
            )}
          </section>

          <details className="group rounded-2xl border border-border">
            <summary className="flex min-h-11 cursor-pointer list-none flex-col justify-center px-3 py-2">
              <span className="flex items-center justify-between gap-2">
                <span className={SECTION_TITLE}>{text.reserve(reserve.length)}</span>
                <span
                  aria-hidden
                  className="transition-transform group-open:rotate-90 motion-reduce:transition-none"
                >
                  ›
                </span>
              </span>
              <span className="text-sm text-muted-foreground">{text.reserveHint}</span>
            </summary>
            <div className="px-3 pb-3">
              {reserve.length === 0 ? (
                <p className="text-sm text-muted-foreground">{text.reserveEmpty}</p>
              ) : (
                <ul aria-label={text.reserve(reserve.length)} className="flex flex-col gap-2">
                  {reserve.map((a) => (
                    <li
                      key={a.athleteId}
                      className={cn("flex min-h-11 items-center gap-3", !a.entered && "opacity-60")}
                    >
                      <SpotSwatch family={a.family} />
                      <span className="min-w-0 flex-1">
                        <span className="block break-words text-sm font-bold">{a.name}</span>
                        <span className="block text-xs text-muted-foreground">
                          {countsIn(a, undefined)?.name ?? a.discipline}{" "}
                          {messages.catalogue.sexShort[a.sex]}
                        </span>
                      </span>
                      {!a.entered ? (
                        <span className="text-xs font-semibold">{messages.team.absent}</span>
                      ) : (
                        editable &&
                        benchSize > 0 && (
                          <button
                            type="button"
                            aria-label={text.toBenchLabel(a.name)}
                            disabled={benchFull}
                            onClick={() => changePlan(addToBench(plan, a.athleteId, benchSize))}
                            className={cn(
                              buttonVariants({ variant: "outline" }),
                              "min-h-11 shrink-0 px-4 text-sm",
                            )}
                          >
                            {benchFull ? text.benchFull : text.toBench}
                          </button>
                        )
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </details>
        </>
      )}

      {editable && athletes.length > 0 && (
        <div className="flex flex-col gap-2 rounded-2xl bg-foreground p-3 text-background shadow-lg">
          {nobodyEntered ? (
            <p className="text-sm font-semibold" aria-live="polite">
              {text.nobodyEntered}
            </p>
          ) : (
            <div className="flex flex-col gap-1" aria-live="polite">
              <p className="text-sm font-bold">
                {text.summary(starters.length, sentPlan.bench.length, tactical)}
              </p>
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
                const ok = await onValidate(matchSheetOf(sentPlaced, sentPlan));
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

      <BottomSheet
        open={open !== null}
        onClose={() => setOpen(null)}
        title={starter && sheetPlace ? text.starterTitle(sheetLabel) : text.sheetTitle(sheetLabel)}
      >
        {starter && draft && (
          <div className="mb-5">
            <PlaceSettings
              name={starter.name}
              sex={starter.sex}
              pb={starter.pb ?? null}
              sb={starter.sb ?? null}
              familyLabel={sheetLabel}
              disciplines={starter.disciplines ?? []}
              discipline={countsIn(starter, draft.discipline)}
              substitutes={substitutesFor(starter)}
              draft={draft}
              divisor={divisor}
              onChange={(next) => setDraft(starter, next)}
              onSave={() => savePlace(starter, draft)}
              onBack={() => setOpen(null)}
            />
          </div>
        )}
        {starter ? (
          <h3 className={cn(SECTION_TITLE, "mb-2")}>{text.changeStarter}</h3>
        ) : (
          <p className="mb-3 text-sm text-muted-foreground">{text.sheetHint(sheetLabel)}</p>
        )}
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
                  : plan.bench.includes(a.athleteId)
                    ? text.candidateOnBench(plan.bench.indexOf(a.athleteId) + 1)
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
                        {countsIn(a, undefined)?.name ?? a.discipline}{" "}
                        {messages.catalogue.sexShort[a.sex]}
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
    </div>
  );
}
