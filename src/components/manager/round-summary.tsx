import { messages } from "@/app/messages.fr";
import { Bib } from "@/components/profile/bib";
import type { Bib as BibValue } from "@/domain/bib";
import { athleteInitials } from "@/domain/manager-team";
import { cn } from "@/lib/utils";

const text = messages.roundReveal;

export type RoundSummaryAthlete = {
  athleteId: string;
  name: string;
  discipline: string;
  offers: {
    userId: string;
    pseudo: string;
    bib: BibValue | null;
    amount: number;
    won: boolean;
    mine: boolean;
  }[];
};

/**
 * Every bid of a closed round (#604): one card per athlete bid on, then its bids from the highest
 * (bib, pseudo, amount); the winning one in gold with « GAGNÉ », the player's own in bold.
 */
export function RoundSummary({
  round,
  athletes,
}: {
  round: number;
  athletes: RoundSummaryAthlete[];
}) {
  return (
    <section aria-labelledby="round-summary" className="flex flex-col gap-3">
      <h2 id="round-summary" className="font-display text-xl font-extrabold">
        {text.allTitle(round)}
      </h2>
      {athletes.length === 0 ? (
        <p className="rounded-card bg-muted p-4 text-sm text-muted-foreground">{text.empty}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {athletes.map((athlete) => (
            <li key={athlete.athleteId}>
              <article
                aria-label={athlete.name}
                className="flex flex-col gap-2 rounded-card border border-border bg-card p-3.5"
              >
                <div className="flex items-center gap-3">
                  <span
                    aria-hidden
                    className="grid size-11 shrink-0 place-items-center rounded-full bg-gradient-to-b from-(--medal-gold-from) to-(--medal-gold-to) font-display font-extrabold text-(--medal-gold-ink)"
                  >
                    {athleteInitials(athlete.name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="break-words font-extrabold leading-tight">{athlete.name}</h3>
                    <p className="text-xs font-semibold text-muted-foreground">
                      {athlete.discipline} · {text.offers(athlete.offers.length)}
                    </p>
                  </div>
                </div>
                <ol className="flex flex-col gap-1">
                  {athlete.offers.map((offer) => (
                    <li
                      key={offer.userId}
                      className={cn(
                        "flex min-h-11 items-center gap-2.5 rounded-xl px-2.5 text-sm",
                        offer.won
                          ? "bg-gradient-to-r from-(--medal-gold-from) to-(--medal-gold-to) text-(--medal-gold-ink)"
                          : "bg-muted",
                        offer.mine && "font-extrabold",
                      )}
                    >
                      {offer.bib && <Bib bib={offer.bib} />}
                      <span className="min-w-0 flex-1 break-words">{offer.pseudo}</span>
                      {offer.won && (
                        <span className="rounded-full bg-(--medal-gold-ink) px-2 py-0.5 text-[11px] font-extrabold tracking-wider text-white">
                          {text.won}
                        </span>
                      )}
                      <span className="shrink-0 font-mono font-bold tabular-nums">
                        {messages.catalogue.price(offer.amount)}
                      </span>
                    </li>
                  ))}
                </ol>
              </article>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
