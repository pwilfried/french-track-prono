"use client";

import { useState, useTransition } from "react";

import { messages } from "@/app/messages.fr";
import type { ErrorCode } from "@/application/errors";
import type { LeagueKind, PredictionLeague } from "@/application/prediction-leagues";
import { JokerHand, type HandCard } from "@/components/jokers/joker-hand";
import { buttonVariants } from "@/components/ui/button";
import { ChipStatus } from "@/components/ui/chip-status";
import {
  isPredictionJoker,
  PREDICTION_JOKERS,
  type JokerHand as JokerHandState,
  type PredictionJoker,
} from "@/domain/league-jokers";
import { cn } from "@/lib/utils";

import { BottomSheet } from "../ui/bottom-sheet";
import { SpyTrendCard, type SpyTrend } from "./league-jokers";

const text = messages.predictionLeagues;

/** Sets the leagues the prediction counts in; the error code when it is refused. */
export type SavePredictionLeagues = (leagueIds: string[]) => Promise<{ error?: ErrorCode }>;

/** The id of the block on the page of the event: the sheet leads there once done. */
const PREDICTION_LEAGUES_ID = "ce-prono-compte";

const kindLabel: Record<LeagueKind, string> = {
  private: messages.leagues.privateBadge,
  public: messages.leagues.publicBadge,
  official: messages.leagues.officialBadge,
};

function KindChip({ kind }: { kind: LeagueKind }) {
  return (
    <ChipStatus tone={kind === "official" ? "brand" : "neutral"}>{kindLabel[kind]}</ChipStatus>
  );
}

/** « Classement général · Toujours »: the podium always counts there, without a choice. */
function GeneralLine() {
  return (
    <li className="flex min-h-14 items-center justify-between gap-3 rounded-2xl border border-border bg-card px-3.5 py-2">
      <span className="min-w-0 font-bold break-words">{text.general}</span>
      <ChipStatus tone="gold">{text.always}</ChipStatus>
    </li>
  );
}

function LeagueText({ league }: { league: PredictionLeague }) {
  return (
    <span className="min-w-0 flex-1">
      <span className="block font-bold break-words">{league.name}</span>
      <span className="block text-sm text-muted-foreground">
        {text.standing(league.memberCount, league.rank)}
      </span>
    </span>
  );
}

/**
 * Brings the player to « Sors tes jokers »: scrolls to the block and highlights it for a moment,
 * so the cards are in view without another tap (#1147).
 */
export function revealJokers() {
  requestAnimationFrame(() => {
    const block = document.getElementById(PREDICTION_LEAGUES_ID);
    if (!block) return;
    block.scrollIntoView({ block: "start" });
    block.classList.add("ring-4", "ring-ring");
    window.setTimeout(() => block.classList.remove("ring-4", "ring-ring"), 2500);
  });
}

/**
 * « Ajouter ce prono à mes ligues » (#1068, #1147): after a save, the player's leagues counting the
 * competition, none checked. Coming from a league (`origin`), the prediction counts there already:
 * the sheet only offers the other ones. A single league to offer is a plain question, without a
 * list. « Plus tard » closes it: the podium counts in the general ranking whatever the choice.
 * After the add the sheet closes on the jokers (`onDone`).
 */
export function PredictionLeaguesSheet({
  open,
  onClose,
  onDone,
  leagues,
  origin,
  lockLabel,
  save,
}: {
  open: boolean;
  onClose: () => void;
  /** The prediction was added: lead to the jokers. */
  onDone: () => void;
  leagues: PredictionLeague[];
  /** The league the player comes from: already counted, never asked. */
  origin?: string;
  /** « samedi 23 novembre à 19:00 », Paris time. */
  lockLabel: string;
  save: SavePredictionLeagues;
}) {
  const [checked, setChecked] = useState<string[]>([]);
  const [error, setError] = useState<ErrorCode | null>(null);
  const [pending, startTransition] = useTransition();
  const toggle = (id: string) =>
    setChecked((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  const counted = leagues.filter((l) => l.counted).map((l) => l.id);
  const originLeague = leagues.find((l) => l.id === origin);
  const offered = leagues.filter((l) => l.id !== origin && !l.counted);
  const single = offered.length === 1 ? offered[0] : undefined;
  const chosen = single ? [single.id] : checked;
  const submit = () =>
    startTransition(async () => {
      setError(null);
      const result = await save([...new Set([...counted, ...(origin ? [origin] : []), ...chosen])]);
      if (result.error) setError(result.error);
      else onDone();
    });
  const lead = originLeague
    ? text.sheetTextOrigin(originLeague.name)
    : single
      ? text.sheetTextOne(single.name)
      : text.sheetText;

  return (
    <BottomSheet open={open} onClose={onClose} title={text.sheetTitle}>
      <div className="flex flex-col gap-3">
        <p className="text-sm leading-relaxed">{lead}</p>
        {!single && (
          <ul className="flex flex-col gap-2">
            <GeneralLine />
            {offered.map((league) => {
              const on = checked.includes(league.id);
              return (
                <li key={league.id}>
                  <label
                    className={cn(
                      "flex min-h-14 cursor-pointer items-center gap-3 rounded-2xl border-2 px-3.5 py-2",
                      on ? "border-accent-text bg-primary-soft" : "border-border bg-card",
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => toggle(league.id)}
                      className="size-6 shrink-0 accent-primary"
                    />
                    <LeagueText league={league} />
                    <KindChip kind={league.kind} />
                  </label>
                </li>
              );
            })}
          </ul>
        )}
        <p className="text-sm text-muted-foreground">{text.sheetNote(lockLabel)}</p>
        {error && (
          <p role="alert" className="text-sm font-semibold text-accent-text">
            {messages.errors[error]}
          </p>
        )}
        <button
          type="button"
          onClick={submit}
          disabled={chosen.length === 0 || pending}
          className={cn(buttonVariants(), "w-full")}
        >
          {pending
            ? text.adding
            : single
              ? text.addTo(single.name)
              : chosen.length === 0
                ? text.pickOne
                : text.add(chosen.length)}
        </button>
        <button
          type="button"
          onClick={onClose}
          disabled={pending}
          className={cn(buttonVariants({ variant: "outline" }), "w-full")}
        >
          {text.later}
        </button>
      </div>
    </BottomSheet>
  );
}

/** My jokers in a league, seen from the open event (#1090), with the trend of a spy played there. */
export type LeagueJokersView = {
  hand: JokerHandState;
  /** Shown once the spy is played on the event. */
  spy?: SpyTrend | null;
};

/** Plays a joker (null: takes it back) in a league; the error code when it is refused. */
export type PlayLeagueJoker = (
  leagueId: string,
  joker: PredictionJoker | null,
) => Promise<{ error?: ErrorCode }>;

/**
 * Under the player's podium (#1068, #1121). Open: « Sors tes jokers », one card per league with
 * its switch and, once on, its hand of jokers; a league switched off shows no card. Locked:
 * « Compte » or « Ne compte pas » per league. The general ranking always counts the podium.
 */
export function PredictionLeaguesBlock({
  leagues,
  locked,
  lockLabel,
  save,
  jokers = {},
  play,
}: {
  leagues: PredictionLeague[];
  locked: boolean;
  lockLabel: string;
  save?: SavePredictionLeagues;
  /** My jokers in each league that has some, by league id (open event only). */
  jokers?: Record<string, LeagueJokersView>;
  play?: PlayLeagueJoker;
}) {
  const [counted, setCounted] = useState(() => leagues.filter((l) => l.counted).map((l) => l.id));
  const [error, setError] = useState<ErrorCode | null>(null);
  const [pending, startTransition] = useTransition();
  // A save elsewhere (the sheet) brings new leagues from the server: follow them.
  const fromServer = leagues
    .filter((l) => l.counted)
    .map((l) => l.id)
    .join(",");
  const [seen, setSeen] = useState(fromServer);
  if (seen !== fromServer) {
    setSeen(fromServer);
    setCounted(fromServer ? fromServer.split(",") : []);
  }
  const toggle = (id: string, on: boolean) => {
    if (!save) return;
    const before = counted;
    const next = on ? [...before, id] : before.filter((x) => x !== id);
    setCounted(next);
    startTransition(async () => {
      setError(null);
      const result = await save(next);
      if (result.error) {
        setCounted(before);
        setError(result.error);
      }
    });
  };

  return (
    <section
      id={PREDICTION_LEAGUES_ID}
      aria-labelledby="prediction-leagues-title"
      aria-busy={pending || undefined}
      className="mx-4 flex scroll-mt-4 flex-col gap-3 rounded-card border border-border bg-card p-4"
    >
      <div>
        <h2 id="prediction-leagues-title" className="font-display text-xl font-extrabold">
          {locked ? text.blockTitle : text.jokersTitle}
        </h2>
        <p className="text-sm text-muted-foreground">
          {locked ? text.lockedText(counted.length) : text.jokersText}
        </p>
      </div>
      <ul className="flex flex-col gap-2">
        {locked ? (
          <GeneralLine />
        ) : (
          <li className="flex min-h-14 items-center justify-between gap-3 rounded-2xl border border-border bg-card px-3.5 py-2">
            <span className="min-w-0 font-bold break-words">
              <span aria-hidden>🌍 </span>
              {text.general}
            </span>
            <ChipStatus tone="gold">{text.noJoker}</ChipStatus>
          </li>
        )}
        {leagues.map((league) => {
          const on = counted.includes(league.id);
          return locked ? (
            <li key={league.id}>
              <div className="flex min-h-14 items-center gap-3 rounded-2xl border border-border bg-card px-3.5 py-2">
                <LeagueText league={league} />
                <ChipStatus tone={on ? "ok" : "ghost"}>
                  {on ? text.counts : text.notCounted}
                </ChipStatus>
              </div>
            </li>
          ) : (
            <LeagueCard
              key={league.id}
              league={league}
              on={on}
              switching={pending}
              toggle={(next) => toggle(league.id, next)}
              jokers={jokers[league.id]}
              play={play}
            />
          );
        })}
      </ul>
      {pending && (
        <p role="status" className="text-sm text-muted-foreground">
          {text.saving}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm font-semibold text-accent-text">
          {messages.errors[error]}
        </p>
      )}
      <p className="text-sm text-muted-foreground">
        {locked ? (
          <>
            <span aria-hidden>🔒 </span>
            {text.lockedFoot}
          </>
        ) : (
          text.openFoot(lockLabel)
        )}
      </p>
    </section>
  );
}

const boxButton = buttonVariants();

/** A league of the open event: its switch and, once on, its hand of jokers (#1121). */
function LeagueCard({
  league,
  on,
  switching,
  toggle,
  jokers: view,
  play,
}: {
  league: PredictionLeague;
  on: boolean;
  switching: boolean;
  toggle: (on: boolean) => void;
  jokers?: LeagueJokersView;
  play?: PlayLeagueJoker;
}) {
  const hand = view?.hand;
  const fromServer = hand?.onEvent ?? null;
  const [placed, setPlaced] = useState<PredictionJoker | null>(fromServer);
  const [seen, setSeen] = useState(fromServer);
  if (seen !== fromServer) {
    setSeen(fromServer);
    setPlaced(fromServer);
  }
  const [ask, setAsk] = useState<"off" | "spy" | null>(null);
  const [error, setError] = useState<ErrorCode | null>(null);
  const [pending, startTransition] = useTransition();
  const jokerText = messages.leagueJokers;

  const send = (joker: PredictionJoker | null, then?: () => void) => {
    if (!play) return;
    setError(null);
    setAsk(null);
    startTransition(async () => {
      const result = await play(league.id, joker);
      if (result.error) setError(result.error);
      else {
        setPlaced(joker);
        then?.();
      }
    });
  };
  const onSwitch = (next: boolean) => {
    setError(null);
    setAsk(null);
    // The spy never comes back: switching off keeps it, without a question.
    if (!next && placed && placed !== "spy") setAsk("off");
    else toggle(next);
  };
  const onPlace = (id: string | null) => {
    if (!isPredictionJoker(id)) return send(null);
    if (id === "spy") {
      setError(null);
      setAsk("spy");
    } else send(id);
  };

  const spent = new Set(hand?.used.map((u) => u.joker).filter((j) => j !== hand.onEvent));
  const cards: HandCard[] = hand
    ? PREDICTION_JOKERS.filter(
        (j) => hand.remaining.includes(j) || spent.has(j) || j === hand.onEvent,
      ).map((j) => ({
        id: j,
        emoji: jokerText.emoji[j],
        name: jokerText.name[j],
        off: spent.has(j) ? { emoji: "✓", label: messages.jokerHand.played } : undefined,
      }))
    : [];

  return (
    <li className="flex flex-col gap-3 rounded-2xl border-2 border-border bg-card p-3.5">
      <label className="flex min-h-11 cursor-pointer items-center gap-3">
        <span className="min-w-0 flex-1">
          <span className="block font-bold break-words">{league.name}</span>
          <span className="block text-sm text-muted-foreground">
            {text.rankLine(league.memberCount, league.rank)}
          </span>
        </span>
        <input
          type="checkbox"
          role="switch"
          aria-label={text.switchLabel(league.name)}
          checked={on}
          disabled={switching || pending}
          onChange={(e) => onSwitch(e.target.checked)}
          className="peer sr-only"
        />
        <span
          aria-hidden
          className={cn(
            "relative h-8 w-14 shrink-0 rounded-full transition-colors peer-focus-visible:ring-4 peer-focus-visible:ring-ring peer-disabled:opacity-50 motion-reduce:transition-none",
            on ? "bg-primary" : "bg-border",
          )}
        >
          <span
            className={cn(
              "absolute top-1 left-1 flex size-6 items-center justify-center rounded-full bg-white text-sm leading-none transition-transform motion-reduce:transition-none",
              on && "translate-x-6",
            )}
          >
            {on ? "👟" : "💤"}
          </span>
        </span>
      </label>
      {ask === "off" && placed ? (
        <div className="flex flex-col gap-2 rounded-2xl bg-gold-soft p-3 text-gold-ink">
          <p className="text-sm font-semibold">
            {text.offConfirm(jokerText.emoji[placed], jokerText.name[placed])}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => send(null, () => toggle(false))}
              className={boxButton}
            >
              {pending ? messages.jokerHand.sending : text.takeBack}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => setAsk(null)}
              className={buttonVariants({ variant: "outline" })}
            >
              {text.keep}
            </button>
          </div>
        </div>
      ) : on ? (
        hand && (
          <JokerHand
            cards={cards}
            placed={placed}
            onPlace={onPlace}
            pending={pending}
            frozen={!hand.canChange || placed === "spy" || !play}
            error={error}
            explain={placed && (placed === "spy" ? jokerText.spySpent : jokerText.explain[placed])}
          />
        )
      ) : (
        hand && <p className="text-sm font-semibold">{text.off}</p>
      )}
      {ask === "spy" && on && (
        <div className="flex flex-col gap-2 rounded-2xl bg-foreground p-3 text-background">
          <p className="text-sm font-semibold">{jokerText.spyAsk}</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => send("spy")} className={boxButton}>
              {jokerText.spyGo}
            </button>
            <button
              type="button"
              onClick={() => setAsk(null)}
              className="inline-flex min-h-11 items-center rounded-full border-2 border-background px-4 text-sm font-bold"
            >
              {jokerText.spyLater}
            </button>
          </div>
        </div>
      )}
      {view?.spy && <SpyTrendCard league={league.name} trend={view.spy} />}
    </li>
  );
}
