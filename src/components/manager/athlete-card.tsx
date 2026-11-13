import { messages } from "@/app/messages.fr";
import type { DisciplineFamily } from "@/domain/discipline";
import type { ManagerSex } from "@/domain/manager-rules";
import { athleteInitials, cardGroupOf, shortAthleteName } from "@/domain/manager-team";
import { cn } from "@/lib/utils";

const text = messages.team;

export type AthleteCardState = "normal" | "selected" | "absent";

/**
 * An athlete of a Manager team, as a gold card (#426): family code top left, price paid top right,
 * initials in the middle (never a photo), first name and initial of the last name with the event at
 * the bottom. The lineup (#427) shows it selected or absent.
 */
export function AthleteCard({
  athlete,
  paid,
  state = "normal",
  compact = false,
}: {
  athlete: { name: string; discipline: string; family: DisciplineFamily; sex: ManagerSex };
  paid: number;
  state?: AthleteCardState;
  /** On a place of the lineup stadium (#427): smaller initials and text, no event line. */
  compact?: boolean;
}) {
  const { name, discipline, family, sex } = athlete;
  return (
    <article
      aria-label={text.cardLabel(name, discipline, paid)}
      className={cn(
        "relative rounded-card",
        state === "selected" && "ring-4 ring-primary ring-offset-2 ring-offset-background",
      )}
    >
      {/* Only the card fades when absent: its tag stays readable. */}
      <div
        className={cn(
          "flex aspect-[3/4] flex-col justify-between bg-gradient-to-b from-(--medal-gold-from) to-(--medal-gold-to) text-(--medal-gold-ink) shadow-sm",
          compact ? "rounded-xl p-1.5" : "rounded-card p-2.5",
          state === "absent" && "opacity-50 grayscale",
        )}
      >
        <div
          className={cn(
            "flex items-start justify-between gap-1 font-extrabold",
            compact ? "text-[10px]" : "text-xs",
          )}
        >
          <span className="font-mono tracking-wider">{text.codes[cardGroupOf(family)]}</span>
          <span className="font-mono tabular-nums">{messages.catalogue.price(paid)}</span>
        </div>
        <span
          aria-hidden
          className={cn(
            "mx-auto grid place-items-center rounded-full border-2 border-(--medal-gold-ink)/30 bg-white/40 font-display font-extrabold",
            compact ? "size-8 text-sm" : "size-14 text-xl",
          )}
        >
          {athleteInitials(name)}
        </span>
        <div className="min-w-0 text-center">
          <p
            className={cn(
              "break-words font-extrabold leading-tight",
              compact ? "text-[11px]" : "text-sm",
            )}
          >
            {shortAthleteName(name)}
          </p>
          {!compact && (
            <p className="truncate text-xs font-semibold">
              {discipline} {messages.catalogue.sexShort[sex]}
            </p>
          )}
        </div>
      </div>
      {state !== "normal" && (
        <span
          className={cn(
            "absolute -top-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-bold",
            state === "selected"
              ? "bg-primary text-primary-foreground"
              : "bg-nuit text-white ring-1 ring-white/40",
          )}
        >
          {state === "selected" ? text.selected : text.absent}
        </span>
      )}
    </article>
  );
}
