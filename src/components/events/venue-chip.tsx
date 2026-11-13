import { messages } from "@/app/messages.fr";
import type { CompetitionVenue } from "@/domain/competition";

import { ChipStatus } from "../ui/chip-status";

/** « Salle » on an indoor competition (#642); nothing for an outdoor one, the usual case. */
export function VenueChip({ venue, className }: { venue: CompetitionVenue; className?: string }) {
  if (venue !== "indoor") return null;
  return (
    <ChipStatus tone="brand" className={className}>
      {messages.adminCompetitions.indoorChip}
    </ChipStatus>
  );
}
