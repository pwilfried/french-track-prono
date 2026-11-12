import Link from "next/link";
import type { ReactNode } from "react";

import { messages } from "@/app/messages.fr";
import { leagueAddChoice } from "@/domain/league";

/**
 * « Compétitions de la ligue »: the competitions it counts, then, for its creator, the form to add
 * a coming one (given as children). One message only when there is nothing to add (#550).
 */
export function LeagueCompetitions({
  competitions,
  addableCount,
  isOwner,
  children,
}: {
  competitions: { slug: string; name: string }[];
  /** How many coming competitions the creator could still add. */
  addableCount: number;
  isOwner: boolean;
  /** The add form, shown to the creator while there is something to add. */
  children?: ReactNode;
}) {
  const choice = leagueAddChoice({ counted: competitions.length, addable: addableCount });
  const empty = !isOwner
    ? messages.leagues.noCompetitionMember
    : choice === "nothing-coming"
      ? messages.leagues.noComingCompetition
      : messages.leagues.noCompetition;
  return (
    <section aria-labelledby="league-competitions" className="flex flex-col gap-2">
      <h2
        id="league-competitions"
        className="text-xs font-bold uppercase tracking-wider text-muted-foreground"
      >
        {messages.leagues.competitionsTitle}
      </h2>
      {competitions.length === 0 ? (
        <p className="rounded-card bg-muted p-4 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {competitions.map((c) => (
            <li key={c.slug} className="min-w-0 max-w-full">
              <Link
                href={`/competitions/${c.slug}`}
                className="inline-flex min-h-11 max-w-full items-center rounded-full border border-border bg-card px-3.5 text-sm font-semibold break-words"
              >
                {c.name}
              </Link>
            </li>
          ))}
        </ul>
      )}
      {isOwner && choice === "choices" && children}
      {isOwner && choice === "all-added" && (
        <p className="text-sm text-muted-foreground">{messages.leagues.nothingToAdd}</p>
      )}
    </section>
  );
}
