"use client";

import { useActionState, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal, useFormStatus } from "react-dom";

import type { PredictionLeague } from "@/application/prediction-leagues";
import {
  PredictionLeaguesBlock,
  PredictionLeaguesSheet,
  type SavePredictionLeagues,
} from "@/components/leagues/prediction-leagues";
import { buttonVariants } from "@/components/ui/button";
import { PodiumPicker, type PickerAthlete } from "@/components/podium/podium-picker";
import { ScaleRules } from "@/components/rules/scale-rules";
import type { DisciplineFamily, MarkUnit } from "@/domain/discipline";
import {
  MARK_MAX_LENGTH,
  markFormat,
  markExample,
  markInputMode,
  markRange,
  readMark,
} from "@/domain/mark-range";
import { isComplete, OTHER_ATHLETE, type PodiumDraft } from "@/domain/podium-draft";
import { athleteHref } from "@/domain/redirect";
import { cn } from "@/lib/utils";

import { messages } from "../../messages.fr";
import { FirstPredictionTips } from "./first-prediction-tips";
import { savePredictionAction, type MarkTexts, type PredictionState } from "./actions";
import { forgetPodium, keepPodium, readKeptPodium } from "./kept-podium";

/** The player's leagues counting the competition, where the podium may count too (#1068). */
export type FormLeagues = {
  list: PredictionLeague[];
  /** « samedi 23 novembre à 19:00 », Paris time. */
  lockLabel: string;
  save: SavePredictionLeagues;
};

/** The podium of a signed-in player on an open event: compose, save. */
export function PredictionForm({
  eventId,
  slug,
  athletes,
  initial,
  markUnit,
  markFamily,
  discipline,
  tolerance,
  scale,
  leagues,
  jokers,
}: {
  eventId: string;
  slug: string;
  athletes: PickerAthlete[];
  initial: PredictionState;
  /** Known for the discipline: the player may then predict a mark per athlete. */
  markUnit?: MarkUnit;
  markFamily?: DisciplineFamily;
  discipline: string;
  tolerance?: number;
  /** The scale shown in the rules sheet of « Règles » (#703). */
  scale: Record<string, number>;
  /** None, or not readable: neither sheet nor block, the podium still counts in the general. */
  leagues?: FormLeagues | null;
  /** The league jokers of the event (#1090), under the leagues the podium counts in. */
  jokers?: ReactNode;
}) {
  const [state, action] = useActionState(savePredictionAction, initial);
  const [draft, setDraft] = useState(initial.draft);
  // Bumped when a podium kept in the tab is restored: the picker starts again from it.
  const [restored, setRestored] = useState(0);
  const podiumRef = useRef<HTMLDivElement>(null);
  const keep = (next: { draft?: PodiumDraft; openedAthlete?: boolean }) =>
    keepPodium(eventId, { draft, openedAthlete: false, ...next });

  // Back from an athlete's page (#699): the podium being built is still there, in view.
  useEffect(() => {
    const kept = readKeptPodium(
      eventId,
      athletes.map((a) => a.athleteId),
    );
    if (!kept) return;
    // Read once the page is on screen: the server cannot see this tab's storage.
    /* eslint-disable react-hooks/set-state-in-effect */
    setDraft(kept.draft);
    setRestored((n) => n + 1);
    /* eslint-enable react-hooks/set-state-in-effect */
    if (kept.openedAthlete) {
      keepPodium(eventId, { ...kept, openedAthlete: false });
      requestAnimationFrame(() => podiumRef.current?.scrollIntoView({ block: "start" }));
    }
    // Only when the page opens: later changes come from the player.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (state.saved || state.error === "PREDICTION_LOCKED") forgetPodium(eventId);
  }, [state, eventId]);
  const complete = isComplete(draft);
  // Locked while saving: the podium is shown read only from then on.
  const locked = state.error === "PREDICTION_LOCKED";
  // Offline, the save would fail without a word: say it, keep the podium as composed.
  const [offline, setOffline] = useState(false);
  // A mark refused is said next to the marks, not above the podium.
  const markError =
    state.error === "MARK_INVALID" || state.error === "MARK_OUT_OF_RANGE" ? state.error : undefined;
  const error = offline
    ? messages.offline.prediction
    : state.error && !markError
      ? messages.errors[state.error]
      : undefined;
  // The notice at the top of the screen, for each answer of a save (#700).
  const [notice, setNotice] = useState<Notice | null>(null);
  const [answered, setAnswered] = useState(state);
  // After the first save of a podium, the sheet offers the leagues once (#1068); later changes
  // go through the block under the podium.
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetOffered, setSheetOffered] = useState(isComplete(initial.draft));
  if (answered !== state) {
    setAnswered(state);
    if (state.saved && !sheetOffered && leagues && leagues.list.length > 0) {
      setSheetOffered(true);
      if (!leagues.list.some((l) => l.counted)) setSheetOpen(true);
    }
    setNotice(
      state.saved
        ? { kind: "saved", text: messages.prediction.savedShort }
        : state.error
          ? { kind: "error", text: messages.errors[state.error] }
          : null,
    );
  }
  // The button shows the save until the player changes the podium or the marks.
  const [editedAfter, setEditedAfter] = useState<PredictionState | null>(null);
  const justSaved = state !== initial && state.saved === true && editedAfter !== state;
  const edited = () => setEditedAfter(state);
  const submit = (data: FormData) => {
    const isOffline = !navigator.onLine;
    setOffline(isOffline);
    if (isOffline) setNotice({ kind: "error", text: messages.offline.prediction });
    else action(data);
  };

  const hasPodium = isComplete(initial.draft) || state.saved === true;

  return (
    <>
      <form action={submit} onChange={edited} className="flex flex-col gap-4">
        <input type="hidden" name="eventId" value={eventId} />
        <input type="hidden" name="slug" value={slug} />
        {markUnit && <input type="hidden" name="markUnit" value={markUnit} />}
        {markFamily && <input type="hidden" name="markFamily" value={markFamily} />}
        {markUnit && <input type="hidden" name="markDiscipline" value={discipline} />}
        {/* Once a podium is saved the tips only push it down (#493). */}
        {!isComplete(initial.draft) && <FirstPredictionTips />}
        {/* Stays for a player who comes back; the notice is what announces a save. */}
        {/* A refused save hides it: the podium shown is not the one saved (#981). */}
        {!state.error && (state.saved || isComplete(initial.draft)) && (
          <p className="mx-4 rounded-2xl bg-success/15 px-3.5 py-3 text-sm font-semibold text-success-text">
            {messages.prediction.saved}
          </p>
        )}
        <div ref={podiumRef} id="podium" className="scroll-mt-4">
          <PodiumPicker
            key={restored}
            athletes={athletes}
            initialDraft={draft}
            error={error}
            disabled={locked}
            onChange={(next: PodiumDraft) => {
              setDraft(next);
              keep({ draft: next });
              edited();
            }}
            helpHref="/regles"
            help={<ScaleRules scale={scale} level={3} idPrefix="rules-" />}
            athleteHref={(athlete) => athleteHref(athlete.slug, `/epreuves/${slug}`)}
            onOpenAthlete={() => keep({ openedAthlete: true })}
          />
        </div>
        {markUnit && !locked && (
          <MarkFields
            draft={draft}
            athletes={athletes}
            unit={markUnit}
            family={markFamily}
            discipline={discipline}
            tolerance={tolerance}
            initialDraft={initial.draft}
            initial={initial.marks}
            serverError={markError}
          />
        )}
        {!locked && (
          <div className="px-4">
            <SaveButton complete={complete} saved={justSaved} />
          </div>
        )}
        <SaveNotice notice={notice} dismiss={setNotice} />
      </form>
      {leagues && leagues.list.length > 0 && hasPodium && !locked && (
        <>
          <PredictionLeaguesBlock
            leagues={leagues.list}
            locked={false}
            lockLabel={leagues.lockLabel}
            save={leagues.save}
          />
          <PredictionLeaguesSheet
            open={sheetOpen}
            onClose={() => setSheetOpen(false)}
            leagues={leagues.list}
            lockLabel={leagues.lockLabel}
            save={leagues.save}
          />
          {jokers}
        </>
      )}
    </>
  );
}

type Notice = { kind: "saved" | "error"; text: string };

/** Waiting, then saved, in the button itself: it sits where the player tapped. */
function SaveButton({ complete, saved }: { complete: boolean; saved: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={!complete || pending}
      className={cn(
        buttonVariants(),
        "w-full",
        saved &&
          !pending &&
          "bg-success-soft text-success-ink ring-2 ring-success ring-inset hover:bg-success-soft",
      )}
    >
      {pending ? (
        <>
          <span
            aria-hidden
            className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent motion-reduce:hidden"
          />
          {messages.prediction.saving}
        </>
      ) : saved ? (
        messages.prediction.savedShort
      ) : (
        messages.prediction.save
      )}
    </button>
  );
}

/**
 * A short notice at the top of the screen, whatever the scroll position. Outside `main` (a
 * portal). An error is only shown here: the form says it as an alert next to the podium or the
 * marks, so it is announced once (#981).
 */
function SaveNotice({
  notice,
  dismiss,
}: {
  notice: Notice | null;
  dismiss: (notice: null) => void;
}) {
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => dismiss(null), 5000);
    return () => window.clearTimeout(timer);
  }, [notice, dismiss]);
  if (!notice) return null;
  const error = notice.kind === "error";
  return createPortal(
    <div
      role={error ? undefined : "status"}
      aria-hidden={error || undefined}
      className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-[calc(env(safe-area-inset-top)+0.75rem)]"
    >
      <p
        className={cn(
          "max-w-md rounded-2xl px-4 py-3 font-semibold shadow-lg",
          error ? "bg-primary text-primary-foreground" : "bg-success-soft text-success-ink",
        )}
      >
        {notice.text}
      </p>
    </div>,
    document.body,
  );
}

const SLOTS = [
  ["first", "m1"],
  ["second", "m2"],
  ["third", "m3"],
] as const;

/** One optional mark per athlete placed on the podium (none for « autre athlète »). */
function MarkFields({
  draft,
  athletes,
  unit,
  family,
  discipline,
  tolerance,
  initialDraft,
  initial,
  serverError,
}: {
  draft: PodiumDraft;
  athletes: PickerAthlete[];
  unit: MarkUnit;
  family?: DisciplineFamily;
  discipline: string;
  tolerance?: number;
  initialDraft: PodiumDraft;
  initial: MarkTexts;
  /** The save refused a mark: every field says why, the podium stays as composed. */
  serverError?: "MARK_INVALID" | "MARK_OUT_OF_RANGE";
}) {
  // A mark belongs to its athlete: moving him on the podium keeps it.
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      SLOTS.flatMap(([slot]) => {
        const id = initialDraft[slot];
        return id ? [[id, initial[slot]]] : [];
      }),
    ),
  );
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const placed = SLOTS.flatMap(([slot, name]) => {
    const athlete = athletes.find((a) => a.athleteId === draft[slot]);
    return athlete && athlete.athleteId !== OTHER_ATHLETE ? [{ slot, name, athlete }] : [];
  });
  if (placed.length === 0) return null;

  const range = markRange(unit, family, discipline);
  const format = markFormat(unit, range);
  const problemOf = (id: string) => {
    const text = (values[id] ?? "").trim();
    if (text === "") return null;
    const read = readMark(text, unit, family, discipline);
    if (read === "bad_mark") return messages.errors.MARK_INVALID;
    if (read === "out_of_range") {
      return messages.picker.markOutOfRange(
        messages.picker.rangeMark(range.min, unit),
        messages.picker.rangeMark(range.max, unit),
        discipline,
      );
    }
    return null;
  };
  const shown = (id: string) => (checked[id] || serverError ? problemOf(id) : null);
  // The database may refuse a mark the form found fine: then it is said once, under the fields.
  const unexplained = serverError && placed.every(({ athlete }) => !problemOf(athlete.athleteId));

  return (
    <fieldset className="mx-4 flex flex-col gap-3 rounded-2xl border border-border p-3.5">
      <legend className="px-1 text-xs font-bold tracking-wider text-muted-foreground uppercase">
        {messages.picker.marksTitle}
      </legend>
      {tolerance !== undefined && (
        <p className="text-sm text-muted-foreground">
          {messages.picker.marksHint(messages.picker.tolerance(tolerance, unit))}
        </p>
      )}
      {placed.map(({ slot, name, athlete }) => {
        const id = athlete.athleteId;
        const problem = shown(id);
        const errorId = `mark-error-${slot}`;
        const formatId = `mark-format-${slot}`;
        const labelId = `mark-label-${slot}`;
        return (
          <div key={slot} className="flex flex-col gap-1">
            <label className="flex items-center gap-3">
              <span id={labelId} className="min-w-0 flex-1 text-sm font-semibold">
                {messages.picker.markLabel(athlete.name)}
              </span>
              <input
                name={name}
                inputMode={markInputMode(unit, family)}
                maxLength={MARK_MAX_LENGTH}
                autoComplete="off"
                value={values[id] ?? ""}
                onChange={(e) => {
                  const text = e.target.value;
                  setValues((v) => ({ ...v, [id]: text }));
                }}
                onBlur={() => setChecked((c) => ({ ...c, [id]: true }))}
                aria-labelledby={labelId}
                aria-invalid={problem ? true : undefined}
                aria-describedby={problem ? `${formatId} ${errorId}` : formatId}
                placeholder={markExample(unit, family, discipline)}
                className="min-h-11 w-28 rounded-xl border-2 border-border bg-background px-3 text-right font-mono font-bold aria-invalid:border-accent-text"
              />
            </label>
            <p id={formatId} className="text-right text-xs text-muted-foreground">
              {messages.picker.markFormat[format]}
            </p>
            {problem && (
              <p
                id={errorId}
                role="alert"
                className="text-right text-sm font-semibold text-accent-text"
              >
                {problem}
              </p>
            )}
          </div>
        );
      })}
      {unexplained && (
        <p role="alert" className="text-sm font-semibold text-accent-text">
          {messages.errors[serverError]}
        </p>
      )}
    </fieldset>
  );
}
