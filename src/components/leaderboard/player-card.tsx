import { messages } from "@/app/messages.fr";
import { Bib } from "@/components/profile/bib";
import type { Bib as BibValue } from "@/domain/bib";

/**
 * The minimal card of a player, opened from a ranking (#342): pseudo, bib, club and rank.
 * Never the e-mail, the sex or the disciplines.
 */
export function PlayerCard({
  id,
  pseudo,
  bib,
  club,
  rank,
  total,
}: {
  id?: string;
  pseudo: string;
  bib: BibValue;
  club: string | null;
  rank: number;
  total: number;
}) {
  const text = messages.playerCard;
  return (
    <section
      id={id}
      aria-label={text.label(pseudo)}
      className="flex items-center gap-3 rounded-2xl border border-border bg-background p-3 text-foreground"
    >
      <Bib bib={bib} className="h-10 min-w-12 text-lg" />
      <dl className="min-w-0 flex-1">
        <dt className="sr-only">{text.pseudo}</dt>
        <dd className="font-display text-lg font-extrabold [overflow-wrap:anywhere]">{pseudo}</dd>
        <dt className="sr-only">{text.club}</dt>
        <dd className="text-sm text-muted-foreground [overflow-wrap:anywhere]">
          {club ?? text.noClub}
        </dd>
        <dt className="sr-only">{text.rank}</dt>
        <dd className="font-mono text-sm font-bold">{text.rankOf(rank, total)}</dd>
      </dl>
    </section>
  );
}
