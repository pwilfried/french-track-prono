import { messages } from "@/app/messages.fr";

/**
 * The minimal card of a player, opened from a ranking (#342): pseudo, avatar, club and rank.
 * Never the e-mail, the sex or the disciplines.
 */
export function PlayerCard({
  id,
  pseudo,
  avatar,
  club,
  rank,
  total,
}: {
  id?: string;
  pseudo: string;
  avatar: string;
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
      <span
        aria-hidden
        className="grid size-14 shrink-0 place-items-center rounded-full border-2 border-brand bg-card text-3xl dark:border-secondary"
      >
        {avatar || "🏃"}
      </span>
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
