import { messages } from "@/app/messages.fr";
import type { DisciplineFamily } from "@/domain/discipline";
import type { ManagerSex } from "@/domain/manager-rules";
import { athleteInitials, cardGroupOf, shortAthleteName } from "@/domain/manager-team";
import { cn } from "@/lib/utils";

const text = messages.team;

export type AthleteCardState = "normal" | "absent";

/**
 * An athlete of a Manager team, as a gold card (#426): family code top left, price paid top right,
 * initials in the middle (never a photo), first name and initial of the last name with the event at
 * the bottom. On the lineup's bench (#427), one not entered in the competition is greyed
 * « Absent·e ». On the stadium, an athlete is a spot (`PlacedSpot`, #775).
 */
export function AthleteCard({
  athlete,
  paid = 0,
  state = "normal",
}: {
  athlete: { name: string; discipline: string; family: DisciplineFamily; sex: ManagerSex };
  paid?: number;
  state?: AthleteCardState;
}) {
  const { name, discipline, family, sex } = athlete;
  return (
    <article aria-label={text.cardLabel(name, discipline, paid)} className="relative rounded-card">
      {/* Only the card fades when absent: its tag stays readable. */}
      <div
        className={cn(
          "flex aspect-[3/4] flex-col justify-between rounded-card bg-gradient-to-b from-(--medal-gold-from) to-(--medal-gold-to) p-2.5 text-(--medal-gold-ink) shadow-sm",
          state === "absent" && "opacity-50 grayscale",
        )}
      >
        <div className="flex items-start justify-between gap-1 text-xs font-extrabold">
          <span className="font-mono tracking-wider">{text.codes[cardGroupOf(family)]}</span>
          <span className="font-mono tabular-nums">{messages.catalogue.price(paid)}</span>
        </div>
        <span
          aria-hidden
          className="mx-auto grid size-14 place-items-center rounded-full border-2 border-current/30 bg-white/40 font-display text-xl font-extrabold"
        >
          {athleteInitials(name)}
        </span>
        <div className="min-w-0 text-center">
          <p className="break-words text-sm font-extrabold leading-tight">
            {shortAthleteName(name)}
          </p>
          <p className="truncate text-xs font-semibold">
            {discipline} {messages.catalogue.sexShort[sex]}
          </p>
        </div>
      </div>
      {state === "absent" && (
        <span className="absolute -top-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-nuit px-2 py-0.5 text-[11px] font-bold text-white ring-1 ring-white/40">
          {text.absent}
        </span>
      )}
    </article>
  );
}
