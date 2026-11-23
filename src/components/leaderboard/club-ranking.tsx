import Link from "next/link";

import { messages } from "@/app/messages.fr";
import { MIN_CLUB_PLAYERS, type RankedClub } from "@/domain/club-ranking";

import { ClubRow, type ClubMember } from "./club-row";
import { decimal } from "./decimal";

const text = messages.clubRanking;

/** « Ton club » (#1132): its rank and average, and what the player brings to it. */
export function MyClubCard({
  clubs,
  myClub,
  meId,
}: {
  clubs: RankedClub<ClubMember>[];
  myClub: { id: string; name: string } | null;
  meId?: string;
}) {
  const mine = myClub ? clubs.find((c) => c.clubId === myClub.id) : undefined;
  const brings = mine?.members.find((m) => m.userId === meId)?.points;
  return (
    <section
      aria-label={text.myClubTitle}
      className="flex flex-col gap-2 rounded-card bg-foreground p-4 text-background"
    >
      <h2 className="text-xs font-bold uppercase tracking-wide opacity-80">{text.myClubTitle}</h2>
      {mine ? (
        <>
          <p className="font-display text-xl font-extrabold leading-tight [overflow-wrap:anywhere]">
            {mine.name}
          </p>
          <div className="flex flex-wrap gap-2 text-sm font-bold">
            <p className="min-h-11 min-w-0 flex-1 basis-28 rounded-xl bg-background/15 px-3 py-2">
              {text.myClubRank(mine.rank, clubs.length)}
            </p>
            <p className="min-h-11 min-w-0 flex-1 basis-28 rounded-xl bg-background/15 px-3 py-2">
              {text.average(decimal(mine.average))}
            </p>
          </div>
          {brings !== undefined && <p className="text-sm font-semibold">{text.brings(brings)}</p>}
        </>
      ) : myClub ? (
        <p className="text-sm [overflow-wrap:anywhere]">
          {text.notRanked(myClub.name, MIN_CLUB_PLAYERS)}
        </p>
      ) : (
        <Link
          href="/profil/modifier"
          className="inline-flex min-h-11 items-center text-sm font-semibold underline underline-offset-4"
        >
          {text.addClub}
        </Link>
      )}
    </section>
  );
}

/**
 * The club ranking of the rankings tab (#386, #1132): « Ton club » for a signed-in player, then
 * every ranked club, each unfolding its players, and the rule under the list.
 */
export function ClubRanking({
  clubs,
  myClub,
  meId,
}: {
  clubs: RankedClub<ClubMember>[];
  /** The player's validated club, or null; absent for a visitor: no « Ton club » card. */
  myClub?: { id: string; name: string } | null;
  meId?: string;
}) {
  return (
    <section aria-label={text.title} className="flex flex-col gap-3">
      {myClub !== undefined && <MyClubCard clubs={clubs} myClub={myClub} meId={meId} />}
      {clubs.length === 0 ? (
        <p className="rounded-card bg-muted p-4 text-sm text-muted-foreground">{text.empty}</p>
      ) : (
        <ol
          aria-label={text.title}
          className="flex flex-col divide-y divide-border overflow-hidden rounded-card border border-border bg-card"
        >
          {clubs.map((club) => (
            <ClubRow key={club.clubId} club={club} mine={club.clubId === myClub?.id} meId={meId} />
          ))}
        </ol>
      )}
      <p className="text-xs text-muted-foreground">{text.rule(MIN_CLUB_PLAYERS)}</p>
    </section>
  );
}
