import Link from "next/link";

import type { MySeason } from "@/application/manager-home";
import type { ManagerLeague } from "@/application/manager-leagues";
import { messages } from "@/app/messages.fr";
import { countdown, splitDuration } from "@/domain/countdown";

const text = messages.managerLeagueCard;

/** « Mercato · tour 2 », « Saison · journée 3 sur 12 »… where the season of the league stands. */
export function managerPhase(season: MySeason): string {
  if (season.step === "champion") return text.phase.over;
  if (season.mercato) return text.phase.mercato(season.mercato.round);
  if (season.round) return text.phase.season(season.round.current, season.round.total);
  return text.phase.waiting;
}

/** The next deadline of the player: the end of the bidding round, or the lineup lock. */
function deadline(season: MySeason, now: Date): string | null {
  const at = season.mercato?.endsAt ?? season.lineup?.lockAt;
  if (!at) return null;
  const left = countdown(now, at);
  if (left.phase !== "open") return null;
  const duration = messages.countdown.duration(splitDuration(left.remainingSeconds));
  return season.mercato ? text.roundEnds(duration) : text.lineupLocks(duration);
}

export type ManagerLeagueCardProps = {
  league: ManagerLeague;
  /** Null when the season could not be read: the card still leads to the league. */
  season: MySeason | null;
  /** For the time left before the next deadline. */
  now: Date;
};

/**
 * One of the player's Manager leagues in the Manager tab (#774, board « 1 · Accueil Manager »):
 * its name, its phase, the player's place, the next deadline and what waits for the player. The
 * whole card leads to the league.
 */
export function ManagerLeagueCard({ league, season, now }: ManagerLeagueCardProps) {
  const cue =
    season?.step === "mercato" || season?.step === "lineup" ? text.cue[season.step] : null;
  const due = season && deadline(season, now);
  const metaId = `league-${league.id}-meta`;
  return (
    <Link
      href={`/manager/${league.id}`}
      aria-label={league.name}
      aria-describedby={metaId}
      className="flex min-h-16 flex-col gap-1 rounded-card border border-border bg-card p-3.5"
    >
      <span className="flex items-start gap-2">
        <span className="min-w-0 flex-1 break-words font-extrabold">{league.name}</span>
        {cue && (
          <span className="shrink-0 rounded-full bg-primary px-2 py-0.5 text-xs font-bold text-primary-foreground">
            {cue}
          </span>
        )}
      </span>
      <span id={metaId} className="flex flex-col text-sm text-muted-foreground">
        {season && (
          <span className="break-words font-semibold text-foreground">
            {[
              managerPhase(season),
              ...(season.standing ? [text.place(season.standing.rank)] : []),
            ].join(" · ")}
          </span>
        )}
        <span>
          {messages.manager.participantsCount(league.memberCount, league.target)} ·{" "}
          {league.isPublic ? messages.manager.publicBadge : messages.manager.privateBadge}
        </span>
        {due && <span className="break-words">{due}</span>}
        {cue && <span className="sr-only">{cue}</span>}
      </span>
    </Link>
  );
}
