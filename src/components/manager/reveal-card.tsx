import { messages } from "@/app/messages.fr";
import { athleteInitials } from "@/domain/manager-team";
import { cn } from "@/lib/utils";

const text = messages.roundReveal;

export type RevealCardProps = {
  card: {
    name: string;
    discipline: string;
    amount: number;
    won: boolean;
    winner: { pseudo: string; amount: number } | null;
  };
  /** Face down until revealed: « ? » and the amount of the bid only. */
  revealed: boolean;
};

/**
 * One of the player's bids at the end of a round (#604): face down (« ? », the amount), then
 * turned over, gold when won, grey with who got the athlete when lost. The turn is a short
 * animation, cut with prefers-reduced-motion.
 */
export function RevealCard({ card, revealed }: RevealCardProps) {
  if (!revealed) {
    return (
      <article
        aria-label={text.hiddenLabel}
        className="flex aspect-[3/4] flex-col items-center justify-center gap-2 rounded-card border-2 border-white/30 bg-white/10 p-2.5 text-center text-white"
      >
        <span aria-hidden className="font-display text-5xl font-extrabold">
          ?
        </span>
        <span className="text-xs font-semibold">{text.yourBid(card.amount)}</span>
      </article>
    );
  }
  return (
    <article
      aria-label={text.cardLabel(card.name, card.won)}
      className={cn(
        "flex aspect-[3/4] flex-col justify-between gap-1 rounded-card p-2.5 text-center shadow-sm motion-safe:animate-card-flip",
        card.won
          ? "bg-gradient-to-b from-(--medal-gold-from) to-(--medal-gold-to) text-(--medal-gold-ink)"
          : "bg-muted text-muted-foreground grayscale",
      )}
    >
      <span
        className={cn(
          "self-center rounded-full px-2 py-0.5 text-[11px] font-extrabold tracking-wider",
          card.won ? "bg-(--medal-gold-ink) text-white" : "bg-foreground/15 text-foreground",
        )}
      >
        {card.won ? text.won : text.lost}
      </span>
      <span
        aria-hidden
        className="mx-auto grid size-12 place-items-center rounded-full border-2 border-current/30 bg-white/40 font-display text-lg font-extrabold"
      >
        {athleteInitials(card.name)}
      </span>
      <div className="min-w-0">
        <p className="break-words text-sm font-extrabold leading-tight">{card.name}</p>
        <p className="truncate text-xs font-semibold">{card.discipline}</p>
        <p className="mt-1 break-words text-xs font-bold">
          {card.won
            ? text.wonLine(card.amount)
            : card.winner && text.lostLine(card.winner.pseudo, card.winner.amount)}
        </p>
      </div>
    </article>
  );
}
