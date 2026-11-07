import Link from "next/link";

import type { EventSummary } from "@/domain/event";
import { messages } from "@/app/messages.fr";

import { ChipStatus, type ChipTone } from "../ui/chip-status";
import { CountdownBadge } from "./countdown-badge";

type StatusVisual = { tone: ChipTone; label: string };

/** Right-hand chip for the event card. Mirrors the french-track-planches v1 direction. */
function statusOf(status: EventSummary["status"], hasMyPrediction: boolean): StatusVisual {
  if (hasMyPrediction) return { tone: "ok", label: "✓ Posé" };
  if (status === "upcoming") return { tone: "brand", label: "+ Prono" };
  if (status === "live") return { tone: "hot", label: "⏱ En cours" };
  return { tone: "neutral", label: "Terminé" };
}

/**
 * One event in a list. Grid: [time] [discipline + meta] [status chip].
 * `now` is passed in to keep the first server render stable and feed the live countdown.
 */
export function EventCard({
  event,
  timeZone,
  hasMyPrediction = false,
  now = new Date(),
}: {
  event: EventSummary;
  timeZone: string;
  hasMyPrediction?: boolean;
  now?: Date;
}) {
  const hour = new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  }).format(new Date(event.startsAt));
  const status = statusOf(event.status, hasMyPrediction);

  return (
    <li>
      <Link
        href={`/epreuves/${event.slug}`}
        className="grid min-h-16 grid-cols-[56px_1fr_auto] items-center gap-3 rounded-card border border-border bg-card p-3 text-card-foreground outline-offset-2 focus-visible:outline-2 focus-visible:outline-ring"
        aria-label={`${event.discipline} ${messages.events.gender[event.gender]} à ${hour}`}
      >
        <div className="flex flex-col items-center gap-0.5">
          <span className="font-sans text-base font-bold leading-none tabular-nums">{hour}</span>
          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Finale
          </span>
        </div>
        <div className="min-w-0">
          <p className="font-display text-base font-bold leading-tight">{event.discipline}</p>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="font-bold text-foreground/80">
              {messages.events.genderInitial[event.gender]}
            </span>
            {event.isFeatured && (
              <>
                <span aria-hidden="true" className="text-border">
                  ·
                </span>
                <span className="font-bold text-accent-text">★ {messages.events.featured}</span>
              </>
            )}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          {event.status === "upcoming" && !hasMyPrediction && (
            <CountdownBadge lockAt={event.lockAt} now={now} />
          )}
          <ChipStatus tone={status.tone}>{status.label}</ChipStatus>
        </div>
      </Link>
    </li>
  );
}
