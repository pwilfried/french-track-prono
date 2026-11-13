import type { StandingRow } from "@/domain/manager-championship";
import type { ManagerParticipant } from "@/application/manager-leagues";
import { Bib } from "@/components/profile/bib";

import { messages } from "../messages.fr";

const { columns, columnLabels, me } = messages.managerChampionship;

type Row = StandingRow & { participant: ManagerParticipant; mine: boolean; champion?: boolean };

/**
 * The standings of a Manager championship (#433), live or frozen at the end of the season (#434):
 * the player's line highlighted, the champion's in gold. The difference column shows during the
 * season only.
 */
export function StandingsTable({
  rows,
  caption,
  difference = false,
}: {
  rows: readonly Row[];
  caption: string;
  difference?: boolean;
}) {
  const figures = difference
    ? (["wins", "draws", "losses", "difference", "points"] as const)
    : (["wins", "draws", "losses", "points"] as const);
  return (
    <table className="w-full border-separate border-spacing-y-1.5 text-sm">
      <caption className="sr-only">{caption}</caption>
      <thead>
        <tr className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
          <th scope="col" className="w-8 px-1 text-left">
            <abbr title={columns.rank} className="no-underline">
              #
            </abbr>
          </th>
          <th scope="col" className="px-1 text-left">
            {columns.player}
          </th>
          {figures.map((c) => (
            <th key={c} scope="col" className="px-1 text-right">
              <abbr title={columnLabels[c]} className="no-underline">
                {columns[c]}
              </abbr>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => {
          const cell = r.champion
            ? "bg-gold-soft text-gold-ink"
            : r.mine
              ? "bg-primary-soft text-primary-ink"
              : "bg-card";
          return (
            <tr key={r.userId} aria-current={r.mine ? "true" : undefined}>
              <td
                className={`${cell} rounded-l-2xl px-2 py-2.5 font-display text-base font-extrabold`}
              >
                {r.rank}
              </td>
              <th scope="row" className={`${cell} px-1 py-2.5 text-left font-semibold`}>
                <span className="flex min-w-0 items-center gap-2">
                  <Bib bib={r.participant.bib} />
                  <span className="min-w-0 break-words">
                    {r.participant.pseudo}
                    {r.mine && <span className="font-normal"> ({me})</span>}
                    {r.champion && (
                      <span className="ml-1 text-xs font-bold uppercase">
                        · {messages.managerSeasonEnd.championBadge}
                      </span>
                    )}
                  </span>
                </span>
              </th>
              <td className={`${cell} px-1 py-2.5 text-right`}>{r.wins}</td>
              <td className={`${cell} px-1 py-2.5 text-right`}>{r.draws}</td>
              <td className={`${cell} px-1 py-2.5 text-right`}>{r.losses}</td>
              {difference && (
                <td className={`${cell} px-1 py-2.5 text-right`}>
                  {messages.managerChampionship.difference(r.difference)}
                </td>
              )}
              <td
                className={`${cell} rounded-r-2xl px-2 py-2.5 text-right font-display text-base font-extrabold`}
              >
                {r.points}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
