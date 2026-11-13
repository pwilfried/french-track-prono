"use client";

import { messages } from "@/app/messages.fr";
import { useNow } from "@/components/countdown/use-now";
import { Bib } from "@/components/profile/bib";
import type { Bib as BibValue } from "@/domain/bib";
import { countdown, splitDuration } from "@/domain/countdown";
import { newestArrival } from "@/domain/manager-league";

const text = messages.catalogue;

/** Time left before the mercato opens, ticking every second unless `now` is given. */
function OpensIn({ opensAt, now }: { opensAt: string | null; now?: Date }) {
  const current = useNow(now);
  const state = opensAt === null ? null : countdown(current, opensAt);
  return (
    <p className="flex flex-wrap items-baseline justify-between gap-x-3">
      <span className="text-xs font-bold uppercase tracking-wide text-white/75">
        {text.beforeMercato}
      </span>
      {state?.phase === "open" ? (
        <span role="timer" aria-live="off" suppressHydrationWarning className="font-bold">
          {text.opensIn}{" "}
          <span suppressHydrationWarning className="font-mono text-secondary tabular-nums">
            {messages.countdown.duration(splitDuration(state.remainingSeconds))}
          </span>
        </span>
      ) : (
        <span className="font-bold">{text.opensLater}</span>
      )}
    </p>
  );
}

/**
 * The night band of the catalogue before the mercato opens (#620): the time left before it opens,
 * the participants by their bibs, the last one to join, and that bids start at the launch.
 * `participants` come first joined first.
 */
export function MercatoBanner({
  opensAt,
  participants,
  now,
}: {
  opensAt: string | null;
  participants: { userId: string; pseudo: string; bib: BibValue }[];
  now?: Date;
}) {
  const newest = newestArrival(participants);
  return (
    <section
      aria-label={text.beforeMercato}
      className="flex flex-col gap-3 rounded-card border border-white/15 bg-nuit p-4 text-white"
    >
      <OpensIn opensAt={opensAt} now={now} />
      <div className="flex flex-col gap-1.5">
        <p className="text-sm font-semibold">{text.participants(participants.length)}</p>
        <ul aria-label={text.participants(participants.length)} className="flex flex-wrap gap-1.5">
          {participants.map((p) => (
            <li key={p.userId} title={p.pseudo}>
              <Bib bib={p.bib} />
              <span className="sr-only">{p.pseudo}</span>
            </li>
          ))}
        </ul>
        {newest && (
          <p className="break-words text-sm text-white/85">
            <span aria-hidden>👋 </span>
            {text.justJoined(newest.pseudo)}
          </p>
        )}
      </div>
      <p className="rounded-2xl bg-white/10 px-3 py-2 text-sm font-semibold">{text.prepare}</p>
    </section>
  );
}
