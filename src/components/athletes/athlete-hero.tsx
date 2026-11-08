import { messages } from "@/app/messages.fr";
import type { EventGender } from "@/domain/event";
import { flagOf } from "@/domain/flag";

/** Name, country and category of an athlete. No photo (non-goal): the flag stands in. */
export function AthleteHero({
  name,
  countryCode,
  gender,
}: {
  name: string;
  countryCode: string;
  gender: EventGender;
}) {
  return (
    <div className="flex items-center gap-4">
      <span
        aria-hidden="true"
        className="grid size-16 shrink-0 place-items-center rounded-full border border-border bg-card text-4xl"
      >
        {flagOf(countryCode) ?? <span className="text-sm font-bold">{countryCode}</span>}
      </span>
      <div className="min-w-0">
        <h1 className="break-words font-display text-3xl font-extrabold leading-tight">{name}</h1>
        <p className="text-sm text-muted-foreground">
          {messages.athlete.subtitle(countryCode, messages.events.gender[gender])}
        </p>
      </div>
    </div>
  );
}
