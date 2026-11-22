"use client";

import { useState, useTransition } from "react";

import { messages } from "@/app/messages.fr";
import type { ErrorCode } from "@/application/errors";
import { buttonVariants } from "@/components/ui/button";
import type { ManagerJoker, ManagerJokerEffect, ManagerJokerHand } from "@/domain/manager-jokers";
import type { ManagerFamily } from "@/domain/manager-rules";

const text = messages.managerJokers;
const common = messages.leagueJokers;
const heading = "text-xs font-bold uppercase tracking-wider text-muted-foreground";
const field = "min-h-11 w-full rounded-xl border-2 border-border bg-background px-3 font-semibold";

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

/** Which athlete a joker aims at, among those the player may choose; null: no target. */
function targetsOf(
  kind: ManagerJoker,
  props: Pick<MatchdayJokersProps, "starters" | "offSheet" | "opponentTeam">,
): { athleteId: string; name: string }[] | null {
  if (kind === "captain") return props.starters;
  if (kind === "false_start") return props.opponentTeam;
  if (kind === "extended_bench") return props.offSheet;
  return null;
}

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

/**
 * « Joker de la journée » on the lineup of a head-to-head (#1091): chosen with the lineup and its
 * target, changed until the lock; after it, the joker played, the opponent's, and « Coaching » to
 * use. The jokers left and played of the season under it.
 */
export function MatchdayJokers(props: MatchdayJokersProps) {
  const { duel, locked, hand } = props;
  return (
    <section aria-labelledby="matchday-joker" className="flex flex-col gap-3">
      <div>
        <h2 id="matchday-joker" className="font-display text-xl font-extrabold">
          {text.title}
        </h2>
        {duel && <p className="text-sm text-muted-foreground">{text.hint}</p>}
      </div>
      {!duel ? (
        <p role="status" className="rounded-card bg-muted p-4 text-sm font-semibold">
          {text.bonusDay}
        </p>
      ) : locked ? (
        <LockedJoker {...props} />
      ) : (
        <JokerPicker {...props} />
      )}
      <div className="flex flex-col gap-1.5">
        <h3 className={heading}>{common.remaining}</h3>
        <p className="text-sm">
          {hand.remaining.length === 0
            ? common.noneLeft
            : hand.remaining.map((j) => text.name[j]).join(" · ")}
        </p>
        <h3 className={heading}>{common.used}</h3>
        <p className="text-sm">
          {hand.used.length === 0
            ? common.noneUsed
            : hand.used.map((u) => text.name[u.kind]).join(" · ")}
        </p>
      </div>
    </section>
  );
}

function Answer({ answer }: { answer: { ok?: string; error?: ErrorCode } | null }) {
  if (answer?.ok)
    return (
      <p role="status" className="text-sm font-semibold text-success-text">
        {answer.ok}
      </p>
    );
  if (answer?.error)
    return (
      <p role="alert" className="text-sm font-semibold text-accent-text">
        {messages.errors[answer.error]}
      </p>
    );
  return null;
}

function JokerPicker(props: MatchdayJokersProps) {
  const { duel, hand, mine, play } = props;
  const [kind, setKind] = useState<ManagerJoker | "">(mine?.kind ?? "");
  const [target, setTarget] = useState<string>(mine?.athleteId ?? "");
  const [answer, setAnswer] = useState<{ ok?: string; error?: ErrorCode } | null>(null);
  const [pending, startTransition] = useTransition();
  const [action, setAction] = useState<"play" | "remove">("play");
  const options = [...(hand.onMatchday ? [hand.onMatchday] : []), ...hand.remaining].filter(
    (j) => j !== "home_advantage" || duel?.home,
  );
  const targets = kind ? targetsOf(kind, props) : null;
  const ready = kind !== "" && (targets === null || target !== "");
  const unchanged = kind === mine?.kind && (targets === null || target === mine?.athleteId);

  const send = (joker: ManagerJoker | null) => {
    setAction(joker ? "play" : "remove");
    setAnswer(null);
    startTransition(async () => {
      const result = await play(joker, joker && targets ? target : null);
      if (result.error) setAnswer({ error: result.error });
      else {
        setAnswer({ ok: joker ? common.played(text.name[joker]) : common.removed });
        if (!joker) {
          setKind("");
          setTarget("");
        }
      }
    });
  };

  return (
    <form
      className="flex flex-col gap-2 rounded-2xl border-2 border-border bg-card p-3.5"
      onSubmit={(e) => {
        e.preventDefault();
        if (kind) send(kind);
      }}
    >
      <label htmlFor="matchday-joker-kind" className="font-bold">
        {text.choose}
      </label>
      <select
        id="matchday-joker-kind"
        value={kind}
        onChange={(e) => {
          setKind(e.target.value as ManagerJoker | "");
          setTarget("");
          setAnswer(null);
        }}
        disabled={pending}
        className={field}
      >
        <option value="">{common.none}</option>
        {options.map((joker) => (
          <option key={joker} value={joker}>
            {text.name[joker]}
          </option>
        ))}
      </select>
      {kind && <p className="text-sm text-muted-foreground">{text.explain[kind]}</p>}
      {kind && targets && kind !== "coaching" && kind !== "home_advantage" && (
        <>
          <label htmlFor="matchday-joker-target" className="font-bold">
            {text.target[kind]}
          </label>
          {targets.length === 0 ? (
            <p className="text-sm text-muted-foreground">{text.noTarget}</p>
          ) : (
            <select
              id="matchday-joker-target"
              value={target}
              onChange={(e) => {
                setTarget(e.target.value);
                setAnswer(null);
              }}
              disabled={pending}
              className={field}
            >
              <option value="">{text.pickAthlete}</option>
              {targets.map((a) => (
                <option key={a.athleteId} value={a.athleteId}>
                  {a.name}
                </option>
              ))}
            </select>
          )}
        </>
      )}
      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={pending || !ready || unchanged}
          className={buttonVariants()}
        >
          {pending && action === "play" ? common.playing : common.play}
        </button>
        {mine && (
          <button
            type="button"
            disabled={pending}
            onClick={() => send(null)}
            className={buttonVariants({ variant: "outline" })}
          >
            {pending && action === "remove" ? common.removing : common.remove}
          </button>
        )}
      </div>
      <Answer answer={answer} />
    </form>
  );
}

function LockedJoker(props: MatchdayJokersProps) {
  const { mine, opponent, names } = props;
  return (
    <div className="flex flex-col gap-2 rounded-2xl border-2 border-border bg-card p-3.5">
      <p className="text-sm text-muted-foreground">{text.fixed}</p>
      {mine && (
        <p className="rounded-xl bg-gold-soft px-3 py-2 text-sm font-semibold text-gold-ink">
          🃏 {text.mine(text.name[mine.kind])}
          {mine.kind !== "coaching" && mine.athleteId && names[mine.athleteId]
            ? ` ${text.on(names[mine.athleteId]!)}`
            : ""}
        </p>
      )}
      {mine?.kind === "coaching" &&
        (mine.coached && mine.athleteId && mine.replacedId ? (
          <p className="text-sm font-semibold">
            {text.coachDone(names[mine.athleteId] ?? "?", names[mine.replacedId] ?? "?")}
          </p>
        ) : (
          <CoachForm {...props} />
        ))}
      <p className="text-sm font-semibold">
        {opponent
          ? `🃏 ${text.opponent(text.name[opponent.kind])}${
              opponent.athleteName ? ` ${text.on(opponent.athleteName)}` : ""
            }`
          : text.opponentNone}
      </p>
    </div>
  );
}

function CoachForm({ starters, offSheet, coach }: MatchdayJokersProps) {
  const [outId, setOutId] = useState("");
  const [inId, setInId] = useState("");
  const [answer, setAnswer] = useState<{ error?: ErrorCode } | null>(null);
  const [pending, startTransition] = useTransition();
  const out = starters.find((s) => s.athleteId === outId);
  const candidates = out?.family ? offSheet.filter((a) => a.family === out.family) : [];

  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        setAnswer(null);
        startTransition(async () => {
          // Once done, the page shows the coaching used in place of this form.
          const result = await coach(outId, inId);
          if (result.error) setAnswer({ error: result.error });
        });
      }}
    >
      <h3 className="font-bold">{text.coachTitle}</h3>
      <p className="text-sm text-muted-foreground">{text.coachHint}</p>
      <label htmlFor="coach-out" className="text-sm font-bold">
        {text.coachOut}
      </label>
      <select
        id="coach-out"
        value={outId}
        onChange={(e) => {
          setOutId(e.target.value);
          setInId("");
          setAnswer(null);
        }}
        disabled={pending}
        className={field}
      >
        <option value="">{text.pickAthlete}</option>
        {starters.map((a) => (
          <option key={a.athleteId} value={a.athleteId}>
            {a.name}
          </option>
        ))}
      </select>
      {out && (
        <>
          <label htmlFor="coach-in" className="text-sm font-bold">
            {text.coachIn}
          </label>
          {candidates.length === 0 ? (
            <p className="text-sm text-muted-foreground">{text.coachNone}</p>
          ) : (
            <select
              id="coach-in"
              value={inId}
              onChange={(e) => {
                setInId(e.target.value);
                setAnswer(null);
              }}
              disabled={pending}
              className={field}
            >
              <option value="">{text.pickAthlete}</option>
              {candidates.map((a) => (
                <option key={a.athleteId} value={a.athleteId}>
                  {a.name}
                </option>
              ))}
            </select>
          )}
        </>
      )}
      <button
        type="submit"
        disabled={pending || !outId || !inId}
        className={buttonVariants({ className: "self-start" })}
      >
        {pending ? text.coachSending : text.coachSend}
      </button>
      <Answer answer={answer} />
    </form>
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
