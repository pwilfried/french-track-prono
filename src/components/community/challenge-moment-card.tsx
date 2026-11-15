import Link from "next/link";

import { messages } from "@/app/messages.fr";
import { ChipStatus } from "@/components/ui/chip-status";
import type { ChallengeMoment } from "@/domain/frenchtrack";

const text = messages.challenge;

/**
 * The « Battez FrenchTrack » moment of the community block (#877), once a challenge is computed:
 * the event, the share of players who beat FrenchTrack and my verdict. The whole card leads to
 * the event.
 */
export function ChallengeMomentCard({ moment }: { moment: ChallengeMoment }) {
  const event = messages.events.name(moment.discipline, moment.gender);
  return (
    <Link
      href={`/epreuves/${moment.slug}`}
      className="flex items-start gap-3 rounded-2xl border border-border bg-card px-3.5 py-3 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary"
    >
      <span
        aria-hidden
        className="grid size-11 shrink-0 place-items-center rounded-full bg-muted text-xl"
      >
        {messages.community.challenge.emoji}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1.5">
        <ChipStatus tone="brand" className="self-start">
          {text.title}
        </ChipStatus>
        <span className="font-bold leading-tight break-words">{event}</span>
        <span className="text-sm break-words">{text.beaten(moment.beaten.percent)}</span>
        <span className="text-sm font-semibold break-words text-muted-foreground">
          {text.verdict[moment.verdict]}
        </span>
      </span>
    </Link>
  );
}
