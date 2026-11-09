import Link from "next/link";

import { messages } from "@/app/messages.fr";
import { MIN_CLUB_PLAYERS, type ClubRank } from "@/domain/club-ranking";

const text = messages.clubRanking;
const medals = ["🥇", "🥈", "🥉"];
const decimal = (n: number) => n.toLocaleString("fr-FR", { maximumFractionDigits: 1 });

/** « Classement des clubs »: my club and its rank, then the podium of the clubs (#386). */
export function ClubRanking({
  clubs,
  myClub,
}: {
  clubs: ClubRank[];
  /** The player's validated club, or null. */
  myClub: { id: string; name: string } | null;
}) {
  const mine = myClub ? clubs.find((c) => c.clubId === myClub.id) : undefined;
  return (
    <section aria-labelledby="club-ranking" className="flex flex-col gap-2">
      <h2
        id="club-ranking"
        className="text-xs font-bold uppercase tracking-wider text-muted-foreground"
      >
        {text.title}
      </h2>
      <p className="rounded-card bg-muted p-3 text-sm">
        {mine ? (
          <>
            <strong>{text.myClub(mine.name, mine.rank, clubs.length)}</strong> ·{" "}
            {text.average(decimal(mine.average))}
          </>
        ) : myClub ? (
          text.notRanked(myClub.name, MIN_CLUB_PLAYERS)
        ) : (
          <Link
            href="/profil/modifier"
            className="font-semibold text-primary underline underline-offset-4"
          >
            {text.addClub}
          </Link>
        )}
      </p>
      {clubs.length === 0 ? (
        <p className="text-sm text-muted-foreground">{text.empty}</p>
      ) : (
        <ol
          aria-label={text.podium}
          className="flex flex-col divide-y divide-border rounded-card border border-border bg-card"
        >
          {clubs.slice(0, 3).map((club) => (
            <li
              key={club.clubId}
              aria-current={club.clubId === myClub?.id ? "true" : undefined}
              className="flex min-h-12 items-center gap-3 px-4 py-2 aria-[current]:bg-gold-soft aria-[current]:text-gold-ink"
            >
              <span aria-hidden="true" className="text-xl">
                {medals[club.rank - 1] ?? ""}
              </span>
              <span className="sr-only">{text.rank(club.rank)}</span>
              <span className="min-w-0 flex-1">
                <span className="block break-words font-bold">{club.name}</span>
                <span className="text-xs opacity-80">{text.players(club.players)}</span>
              </span>
              <span className="font-mono font-bold tabular-nums">{decimal(club.average)}</span>
            </li>
          ))}
        </ol>
      )}
      <p className="text-xs text-muted-foreground">{text.rule(MIN_CLUB_PLAYERS)}</p>
    </section>
  );
}
