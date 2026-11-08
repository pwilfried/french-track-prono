import Link from "next/link";

import { messages } from "@/app/messages.fr";
import type { AthleteRace } from "@/domain/athlete";

/**
 * The latest official results of an athlete. A race of the competition the app plays links to its
 * event page (`linkable` says which).
 */
export function RecentRaces({
  races,
  timeZone,
  linkable,
}: {
  races: AthleteRace[];
  timeZone: string;
  linkable: (race: AthleteRace) => boolean;
}) {
  if (races.length === 0) {
    return <p className="rounded-card bg-muted p-4 text-sm">{messages.athlete.noRace}</p>;
  }
  const day = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", timeZone });
  return (
    <ol className="flex flex-col">
      {races.map((race) => {
        const title = <span className="block break-words font-semibold">{race.discipline}</span>;
        return (
          <li
            key={`${race.competitionSlug}/${race.eventSlug}`}
            className="flex min-h-14 items-center gap-3 border-b border-border py-2"
          >
            <span className="w-14 shrink-0 font-mono text-xs text-muted-foreground">
              {day.format(new Date(race.startsAt))}
            </span>
            <span className="min-w-0 flex-1">
              {linkable(race) ? (
                <Link href={`/epreuves/${race.eventSlug}`} className="underline">
                  {title}
                </Link>
              ) : (
                title
              )}
              <span className="block break-words text-xs text-muted-foreground">
                {race.meeting}
              </span>
            </span>
            <span className="shrink-0 text-right">
              <span className="block font-mono font-bold tabular-nums">{race.mark ?? "—"}</span>
              <span className="block text-xs text-muted-foreground">
                {messages.athlete.rank(race.rank)}
              </span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
