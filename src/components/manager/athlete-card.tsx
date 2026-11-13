import { messages } from "@/app/messages.fr";
import type { DisciplineFamily } from "@/domain/discipline";
import type { ManagerSex } from "@/domain/manager-rules";
import { athleteInitials, cardGroupOf, shortAthleteName } from "@/domain/manager-team";
import { cn } from "@/lib/utils";

const text = messages.team;

export type AthleteCardState = "normal" | "selected" | "absent";

/** A card of a head-to-head (#605): the athlete's points and sporting bonuses. */
export type AthleteCardScore = { points: number | null; bonus: number };

/**
 * An athlete of a Manager team, as a gold card (#426): family code top left, price paid top right,
 * initials in the middle (never a photo), first name and initial of the last name with the event at
 * the bottom. The lineup (#427) shows it selected or absent. In a head-to-head (#605) it shows the
 * bonus top right and the points at the bottom instead, in light blue for the opponent; an athlete
 * at 0 gets a dashed red frame.
 */
export function AthleteCard({
  athlete,
  paid = 0,
  score,
  tone = "gold",
  state = "normal",
  compact = false,
}: {
  athlete: { name: string; discipline: string; family: DisciplineFamily; sex: ManagerSex };
  paid?: number;
  score?: AthleteCardScore;
  tone?: "gold" | "blue";
  state?: AthleteCardState;
  /** On a place of the lineup stadium (#427): smaller initials and text, no event line. */
  compact?: boolean;
}) {
  const { name, discipline, family, sex } = athlete;
  const zero = score?.points === 0;
  return (
    <article
      aria-label={
        score
          ? text.scoredCardLabel(name, discipline, score.points, score.bonus)
          : text.cardLabel(name, discipline, paid)
      }
      className={cn(
        "relative rounded-card",
        state === "selected" && "ring-4 ring-primary ring-offset-2 ring-offset-background",
      )}
    >
      {/* Only the card fades when absent: its tag stays readable. */}
      <div
        className={cn(
          "flex aspect-[3/4] flex-col justify-between shadow-sm",
          tone === "gold"
            ? "bg-gradient-to-b from-(--medal-gold-from) to-(--medal-gold-to) text-(--medal-gold-ink)"
            : "bg-gradient-to-b from-(--duel-blue-from) to-(--duel-blue-to) text-(--duel-blue-ink)",
          compact ? "rounded-xl p-1.5" : "rounded-card p-2.5",
          state === "absent" && "opacity-50 grayscale",
          zero && "outline-2 outline-offset-1 outline-dashed outline-primary",
        )}
      >
        <div
          className={cn(
            "flex items-start justify-between gap-1 font-extrabold",
            compact ? "text-[10px]" : "text-xs",
          )}
        >
          <span className="font-mono tracking-wider">{text.codes[cardGroupOf(family)]}</span>
          <span className="font-mono tabular-nums">
            {score ? score.bonus > 0 && text.bonus(score.bonus) : messages.catalogue.price(paid)}
          </span>
        </div>
        <span
          aria-hidden
          className={cn(
            "mx-auto grid place-items-center rounded-full border-2 border-current/30 bg-white/40 font-display font-extrabold",
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
          {score && (
            <p
              className={cn(
                "font-mono font-extrabold tabular-nums",
                compact ? "text-[11px]" : "text-sm",
              )}
            >
              {text.points(score.points)}
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
