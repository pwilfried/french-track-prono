"use client";

import { useState, useTransition } from "react";

import type { ErrorCode } from "@/application/errors";
import { messages } from "@/app/messages.fr";
import { Bib } from "@/components/profile/bib";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import {
  PRESET_MESSAGES,
  type MomentEmoji,
  type MomentReactions as Reactions,
  type PresetMessage,
} from "@/domain/moment-reactions";

const text = messages.leagues.feed.reactions;

type Result = { error?: ErrorCode };

/** What the reactions of a moment do; the page passes its server actions (#672). */
export type MomentReactionActions = {
  react(leagueId: string, momentKey: string, emoji: MomentEmoji, on: boolean): Promise<Result>;
  send(leagueId: string, momentKey: string, message: PresetMessage): Promise<Result>;
  report(leagueId: string, reactionId: string): Promise<Result>;
};

const chip =
  "inline-flex min-h-11 items-center justify-center gap-1 rounded-2xl border px-2.5 disabled:opacity-60";

/**
 * Under a moment of the feed (#672): the four emojis with their counts (tap to react, tap mine
 * again to remove it), « Message » opening the preset messages, then the messages sent with the
 * pseudo and bib of who sent them, each with « Signaler ». No free text (non-goal 6).
 */
export function MomentReactions({
  leagueId,
  momentKey,
  reactions,
  actions,
}: {
  leagueId: string;
  momentKey: string;
  reactions: Reactions;
  actions: MomentReactionActions;
}) {
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [feedback, setFeedback] = useState<{ error?: ErrorCode; sent?: boolean }>({});

  const run = (work: () => Promise<Result>, sent = false) =>
    start(async () => {
      setFeedback({});
      const result = await work();
      setFeedback(result.error ? { error: result.error } : { sent });
    });

  return (
    <div className="flex flex-col gap-2">
      <div role="group" aria-label={text.group} className="flex flex-wrap gap-1.5">
        {reactions.emojis.map(({ code, count, mine }) => (
          <button
            key={code}
            type="button"
            disabled={pending}
            aria-pressed={mine}
            aria-label={text.label(text.names[code], count, mine)}
            onClick={() => run(() => actions.react(leagueId, momentKey, code, !mine))}
            className={`${chip} min-w-11 bg-background text-lg ${
              mine ? "border-2 border-ring bg-muted" : "border-border"
            }`}
          >
            <span aria-hidden="true">{text.emoji[code]}</span>
            {count > 0 && (
              <span aria-hidden="true" className="font-mono text-sm font-bold tabular-nums">
                {count}
              </span>
            )}
          </button>
        ))}
        <button
          type="button"
          disabled={pending}
          aria-label={text.messageLabel}
          onClick={() => setOpen(true)}
          className={`${chip} border-border bg-background text-sm font-bold`}
        >
          <span aria-hidden="true">💬</span>
          {text.message}
        </button>
      </div>

      <p role="status" className="text-sm font-semibold empty:hidden">
        {pending ? text.pending : feedback.sent ? text.sent : ""}
      </p>
      {feedback.error && (
        <p role="alert" className="text-sm font-semibold text-accent-text">
          {messages.errors[feedback.error]}
        </p>
      )}

      {reactions.messages.length > 0 && (
        <ul aria-label={text.list} className="flex flex-col gap-1.5">
          {reactions.messages.map((m) => (
            <li
              key={m.id}
              className="flex min-w-0 items-center gap-2 rounded-xl border border-border bg-background px-2.5 py-1.5 text-sm"
            >
              {m.bib && <Bib bib={m.bib} />}
              <span className="min-w-0 flex-1 break-words">
                <span className="font-bold">{m.pseudo}</span> · {text.messages[m.code]}
              </span>
              {!m.mine &&
                (m.reported ? (
                  <span className="shrink-0 text-xs font-semibold text-muted-foreground">
                    {text.reported}
                  </span>
                ) : (
                  <button
                    type="button"
                    disabled={pending}
                    aria-label={text.reportLabel(m.pseudo)}
                    onClick={() => run(() => actions.report(leagueId, m.id))}
                    className="inline-flex min-h-11 shrink-0 items-center px-1 text-xs font-bold text-muted-foreground underline disabled:opacity-60"
                  >
                    {text.report}
                  </button>
                ))}
            </li>
          ))}
        </ul>
      )}

      <PresetMessageSheet
        open={open}
        onClose={() => setOpen(false)}
        current={reactions.myMessage}
        pending={pending}
        onSend={(message) => {
          setOpen(false);
          run(() => actions.send(leagueId, momentKey, message), true);
        }}
      />
    </div>
  );
}

/** The sheet of preset messages (#672): one tap sends it; mine is marked. */
export function PresetMessageSheet({
  open,
  onClose,
  current,
  pending,
  onSend,
}: {
  open: boolean;
  onClose: () => void;
  current: PresetMessage | null;
  pending: boolean;
  onSend: (message: PresetMessage) => void;
}) {
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={text.sheetTitle}
      header={<p className="text-sm text-muted-foreground">{text.sheetHint}</p>}
    >
      <ul className="flex flex-col gap-2">
        {PRESET_MESSAGES.map((message) => (
          <li key={message}>
            <button
              type="button"
              disabled={pending}
              aria-pressed={current === message}
              onClick={() => onSend(message)}
              className={`flex min-h-12 w-full items-center justify-between gap-3 rounded-2xl border px-4 text-left font-bold disabled:opacity-60 ${
                current === message ? "border-2 border-ring bg-muted" : "border-border bg-card"
              }`}
            >
              <span className="min-w-0 break-words">{text.messages[message]}</span>
              {current === message && (
                <span className="shrink-0 text-xs font-semibold text-muted-foreground">
                  {text.current}
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </BottomSheet>
  );
}
