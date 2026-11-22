"use client";

import { useState, useTransition } from "react";

import { messages } from "@/app/messages.fr";
import type { ErrorCode } from "@/application/errors";
import { JokerHand, type HandCard } from "@/components/jokers/joker-hand";
import { buttonVariants } from "@/components/ui/button";
import {
  isManagerJoker,
  MANAGER_JOKERS,
  type ManagerJoker,
  type ManagerJokerEffect,
  type ManagerJokerHand,
} from "@/domain/manager-jokers";
import type { ManagerFamily } from "@/domain/manager-rules";
import { cn } from "@/lib/utils";

const text = messages.managerJokers;
const common = messages.leagueJokers;
const heading = "text-xs font-bold uppercase tracking-wider text-muted-foreground";

/** The jokers of a Manager league, each with what it does (#1091): read only. */
export function ManagerJokerList({ jokers }: { jokers: readonly ManagerJoker[] }) {
  if (jokers.length === 0)
    return <p className="text-sm text-muted-foreground">{common.createEmpty}</p>;
  return (
    <ul className="flex flex-col gap-2">
      {jokers.map((joker) => (
        <li key={joker} className="rounded-2xl bg-gold-soft px-3.5 py-2.5 text-gold-ink">
          <span className="block font-extrabold">🃏 {text.name[joker]}</span>
          <span className="block text-sm">{text.explain[joker]}</span>
        </li>
      ))}
    </ul>
  );
}

/** An athlete of the player's team, as the jokers need them. */
export type JokerAthlete = { athleteId: string; name: string; family: ManagerFamily | null };

/** The joker the player plays on the matchday, with its target. */
export type MatchdayJoker = {
  kind: ManagerJoker;
  athleteId: string | null;
  replacedId: string | null;
  coached: boolean;
};

export type JokerAnswer = Promise<{ error?: ErrorCode }>;

/** A joker that needs an athlete, and the athletes it may aim at. */
type Target = "captain" | "false_start" | "extended_bench";
const hasTarget = (kind: ManagerJoker | null): kind is Target =>
  kind === "captain" || kind === "false_start" || kind === "extended_bench";

type MatchdayJokersProps = {
  /** The head-to-head of the matchday; null on a bonus one. */
  duel: { home: boolean } | null;
  locked: boolean;
  hand: ManagerJokerHand;
  mine: MatchdayJoker | null;
  /** The opponent's joker, once locked: its name and the athlete it aims at. */
  opponent: { kind: ManagerJoker; athleteName: string | null } | null;
  /** The starters of the match sheet now. */
  starters: JokerAthlete[];
  /** The athletes of the team neither starter nor substitute. */
  offSheet: JokerAthlete[];
  opponentTeam: { athleteId: string; name: string }[];
  /** The name of any athlete of the team or of the opponent's. */
  names: Record<string, string>;
  play: (kind: ManagerJoker | null, athleteId: string | null) => JokerAnswer;
  coach: (outId: string, inId: string) => JokerAnswer;
};

const familyEmoji = (family: ManagerFamily | null) =>
  family ? `${text.familyEmoji[family]} ` : "";

/** An athlete to choose as the target of a joker: a chip of at least 44 px. */
type Chip = { id: string; label: string; disabled?: boolean };

function Chips({
  label,
  chips,
  selected,
  onPick,
  disabled,
}: {
  label: string;
  chips: Chip[];
  selected: string | null;
  onPick: (id: string) => void;
  disabled?: boolean;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {chips.map((chip) => {
        const on = chip.id === selected;
        return (
          <button
            key={chip.id}
            type="button"
            aria-pressed={on}
            disabled={disabled || chip.disabled}
            onClick={() => onPick(chip.id)}
            className={cn(
              "inline-flex min-h-11 max-w-full items-center rounded-full border-2 px-3 text-left text-sm font-semibold break-words disabled:opacity-50",
              on
                ? "border-gold-ink bg-gold-ink text-gold-soft"
                : "border-gold-ink/40 bg-background text-foreground",
            )}
          >
            {chip.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * « Ta carte de la journée » on the lineup of a head-to-head (#1091, #1121): a hand of the season's
 * jokers, one put down with its target until the lock; after it, both cards face up, and
 * « Coaching » to use.
 */
export function MatchdayJokers(props: MatchdayJokersProps) {
  const { duel, locked } = props;
  return (
    <section aria-labelledby="matchday-joker" className="flex flex-col gap-3">
      <div>
        <h2 id="matchday-joker" className="font-display text-xl font-extrabold">
          {text.title}
        </h2>
        {duel && <p className="text-sm text-muted-foreground">{text.hint}</p>}
      </div>
      {!duel ? (
        <p className="rounded-card bg-muted p-4 text-sm font-semibold">{text.bonusDay}</p>
      ) : locked ? (
        <Revealed {...props} />
      ) : (
        <MatchdayHand {...props} home={duel.home} />
      )}
    </section>
  );
}

function MatchdayHand(props: MatchdayJokersProps & { home: boolean }) {
  const { hand, mine, play, home } = props;
  const [placed, setPlaced] = useState<ManagerJoker | null>(mine?.kind ?? null);
  const [target, setTarget] = useState<string | null>(mine?.athleteId ?? null);
  // What the server has: « kind:athlete ».
  const [saved, setSaved] = useState(mine ? `${mine.kind}:${mine.athleteId}` : null);
  const [error, setError] = useState<ErrorCode | null>(null);
  const [pending, startTransition] = useTransition();

  const send = (kind: ManagerJoker | null, athleteId: string | null) => {
    setError(null);
    startTransition(async () => {
      const result = await play(kind, athleteId);
      if (result.error) setError(result.error);
      else {
        setPlaced(kind);
        setTarget(athleteId);
        setSaved(kind && `${kind}:${athleteId}`);
      }
    });
  };
  const onPlace = (id: string | null) => {
    setError(null);
    if (!isManagerJoker(id)) {
      // Taking back a card the server has: it leaves the matchday; otherwise it was only chosen.
      if (saved) send(null, null);
      else {
        setPlaced(null);
        setTarget(null);
      }
      return;
    }
    // A card with a target waits for its athlete before it is sent.
    if (hasTarget(id)) {
      setPlaced(id);
      setTarget(null);
    } else send(id, null);
  };

  const kinds = new Set([
    ...hand.remaining,
    ...hand.used.map((u) => u.kind),
    ...(hand.onMatchday ? [hand.onMatchday] : []),
  ]);
  const spent = new Set(hand.used.map((u) => u.kind).filter((k) => k !== hand.onMatchday));
  const cards: HandCard[] = MANAGER_JOKERS.filter((k) => kinds.has(k)).map((k) => ({
    id: k,
    emoji: text.emoji[k],
    name: text.name[k],
    off: spent.has(k)
      ? { emoji: "✓", label: messages.jokerHand.played }
      : k === "home_advantage" && !home
        ? text.away
        : undefined,
  }));

  const chips: Chip[] =
    placed === "captain"
      ? props.starters.map((a) => ({ id: a.athleteId, label: familyEmoji(a.family) + a.name }))
      : placed === "false_start"
        ? props.opponentTeam.map((a) => ({ id: a.athleteId, label: `❓ ${a.name}` }))
        : placed === "extended_bench"
          ? props.offSheet.map((a) => ({ id: a.athleteId, label: familyEmoji(a.family) + a.name }))
          : [];

  return (
    <JokerHand
      cards={cards}
      placed={placed}
      onPlace={onPlace}
      pending={pending}
      error={error}
      explain={placed && text.explain[placed]}
    >
      {hasTarget(placed) && (
        <div className="flex flex-col gap-2 pt-1">
          <p className="text-sm font-bold">
            {placed === "false_start"
              ? text.target.false_start(text.opponentName)
              : text.target[placed]}
          </p>
          {chips.length === 0 ? (
            <p className="text-sm">{text.noTarget}</p>
          ) : (
            <Chips
              label={
                placed === "false_start"
                  ? text.target.false_start(text.opponentName)
                  : text.target[placed]
              }
              chips={chips}
              selected={target}
              disabled={pending}
              onPick={(id) => send(placed, id)}
            />
          )}
        </div>
      )}
      {placed === "coaching" && <p className="text-sm font-semibold">{text.coachingWaits}</p>}
      {!pending && saved === `${placed}:${target}` && hasTarget(placed) && target && (
        <p role="status" className="text-sm font-semibold">
          {text.targetDone(text.name[placed], props.names[target] ?? "?")}
        </p>
      )}
    </JokerHand>
  );
}

/** One side of the reveal: the card played, with the athlete it aims at. */
function FaceUp({
  who,
  kind,
  athlete,
}: {
  who: string;
  kind: ManagerJoker | null;
  athlete: string | null;
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-1 rounded-xl border-2 border-[var(--medal-gold-to)] bg-gold-soft px-2 py-3 text-center text-gold-ink">
      <span className="text-xs font-bold uppercase tracking-wider">{who}</span>
      <span aria-hidden className="text-[30px] leading-none">
        {kind ? text.emoji[kind] : "🫥"}
      </span>
      <span className="text-sm font-extrabold break-words">
        {kind ? text.name[kind] : text.noCard}
      </span>
      {athlete && <span className="w-full text-xs break-words">{athlete}</span>}
    </div>
  );
}

function Revealed(props: MatchdayJokersProps) {
  const { mine, opponent, names } = props;
  const myTarget = mine && hasTarget(mine.kind) && mine.athleteId ? names[mine.athleteId] : null;
  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-foreground p-3.5 text-background">
      <p className="font-bold">{text.revealed}</p>
      <div className="flex gap-2">
        <FaceUp who={text.you} kind={mine?.kind ?? null} athlete={myTarget ?? null} />
        <FaceUp
          who={text.them}
          kind={opponent?.kind ?? null}
          athlete={opponent?.athleteName ?? null}
        />
      </div>
      <p className="text-sm font-semibold">{text.revealTaunt(!!mine, !!opponent)}</p>
      {mine?.kind === "coaching" &&
        (mine.coached && mine.athleteId && mine.replacedId ? (
          <p className="text-sm font-semibold">
            {text.coachDone(names[mine.athleteId] ?? "?", names[mine.replacedId] ?? "?")}
          </p>
        ) : (
          <Coaching {...props} />
        ))}
    </div>
  );
}

/** « Coaching » after the lock, in two steps: who goes out, then who comes in (same family). */
function Coaching({ starters, offSheet, coach }: MatchdayJokersProps) {
  const [outId, setOutId] = useState<string | null>(null);
  const [inId, setInId] = useState<string | null>(null);
  const [error, setError] = useState<ErrorCode | null>(null);
  const [pending, startTransition] = useTransition();
  const out = starters.find((s) => s.athleteId === outId);
  const candidates = out?.family ? offSheet.filter((a) => a.family === out.family) : [];
  const chip = (a: JokerAthlete): Chip => ({
    id: a.athleteId,
    label: familyEmoji(a.family) + a.name,
  });

  return (
    <div className="flex flex-col gap-2 rounded-xl bg-gold-soft p-3 text-gold-ink">
      <p className="text-sm">{text.explain.coaching}</p>
      <p className="text-sm font-bold">{text.coachOut}</p>
      <Chips
        label={text.coachOut}
        chips={starters.map(chip)}
        selected={outId}
        disabled={pending}
        onPick={(id) => {
          setOutId(id);
          setInId(null);
          setError(null);
        }}
      />
      <p className="text-sm font-bold">{text.coachIn}</p>
      {!out ? (
        <p className="text-sm">{text.coachPickOut}</p>
      ) : candidates.length === 0 ? (
        <p className="text-sm">{text.coachNone}</p>
      ) : (
        <Chips
          label={text.coachIn}
          chips={candidates.map(chip)}
          selected={inId}
          disabled={pending}
          onPick={(id) => {
            setInId(id);
            setError(null);
          }}
        />
      )}
      <button
        type="button"
        disabled={pending || !outId || !inId}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            // Once done, the page shows the coaching used in place of these steps.
            const result = await coach(outId!, inId!);
            if (result.error) setError(result.error);
          });
        }}
        className={buttonVariants({ className: "self-start" })}
      >
        {pending ? text.coachSending : text.coachSend}
      </button>
      {error && (
        <p role="alert" className="text-sm font-semibold text-accent-text">
          {messages.errors[error]}
        </p>
      )}
    </div>
  );
}

/**
 * What a joker changed, in points: the extended bench and the coaching say what their athlete
 * brought (already in the score), the others what they added or took; 0 is « sans effet ».
 */
function EffectPoints({ kind, points }: { kind: ManagerJoker; points: number }) {
  return (
    <span className="shrink-0 font-mono text-sm font-extrabold tabular-nums">
      {points === 0
        ? text.noEffect
        : kind === "extended_bench" || kind === "coaching"
          ? text.brought(points)
          : text.effectPoints(points)}
    </span>
  );
}

/** What the jokers of a head-to-head did to a score (#1091), with the athlete they aimed at. */
export function JokerEffects({
  effects,
}: {
  effects: readonly (ManagerJokerEffect & { name?: string | null })[];
}) {
  if (effects.length === 0) return null;
  return (
    <section aria-labelledby="joker-effects" className="flex flex-col gap-2">
      <h2 id="joker-effects" className={heading}>
        {text.effectsTitle}
      </h2>
      <ul aria-labelledby="joker-effects" className="flex flex-col gap-1.5">
        {effects.map((e) => {
          return (
            <li
              key={`${e.by}-${e.kind}`}
              className="flex min-h-11 items-center justify-between gap-3 rounded-2xl bg-gold-soft px-3.5 py-2 text-gold-ink"
            >
              <span className="min-w-0 break-words text-sm font-semibold">
                🃏 {text.effect(text.name[e.kind], e.by, e.name ?? null)}
              </span>
              <EffectPoints kind={e.kind} points={e.points} />
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** A side of a head-to-head and the joker it played, seen from the lock (#1091). */
export type DuelJokerSide = {
  pseudo: string;
  joker: { kind: ManagerJoker; athleteName: string | null; points: number | null } | null;
};

/** The jokers of both sides of a head-to-head, with what they changed once scored. */
export function DuelJokers({ sides }: { sides: DuelJokerSide[] }) {
  const played = sides.filter((s) => s.joker !== null);
  if (played.length === 0) return null;
  return (
    <section aria-labelledby="duel-jokers" className="flex flex-col gap-2">
      <h2 id="duel-jokers" className={heading}>
        {text.effectsTitle}
      </h2>
      <ul aria-labelledby="duel-jokers" className="flex flex-col gap-1.5">
        {played.map(({ pseudo, joker }) => {
          const { kind, athleteName, points } = joker!;
          return (
            <li
              key={pseudo}
              className="flex min-h-11 items-center justify-between gap-3 rounded-2xl bg-gold-soft px-3.5 py-2 text-gold-ink"
            >
              <span className="min-w-0 break-words text-sm font-semibold">
                🃏 {text.duelLine(pseudo, text.name[kind], athleteName)}
              </span>
              {points !== null && <EffectPoints kind={kind} points={points} />}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
