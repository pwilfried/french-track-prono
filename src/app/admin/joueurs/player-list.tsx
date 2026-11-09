import type { ModeratedPlayer } from "@/application/player-moderation";

import { messages } from "../../messages.fr";
import { BlockForm, DeletePlayerForm } from "./player-forms";

const text = messages.adminPlayers;
const day = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "Europe/Paris",
});

/** The players found, each with its block and delete forms (none for an admin). */
export function PlayerList({ players }: { players: ModeratedPlayer[] }) {
  return (
    <ul aria-label={text.title} className="flex flex-col gap-3">
      {players.map((player) => (
        <li
          key={player.id}
          className="flex flex-col gap-3 rounded-card border border-border bg-card p-3.5"
        >
          <div className="flex items-center gap-3">
            <span aria-hidden className="text-2xl">
              {player.avatar}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-extrabold [overflow-wrap:anywhere]">
                {player.pseudo}
                {player.blocked ? (
                  <span className="ml-2 rounded-full bg-primary-soft px-2 py-0.5 text-xs font-bold text-primary-ink">
                    {text.blocked}
                  </span>
                ) : null}
                {player.isAdmin ? (
                  <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs font-bold">
                    {text.admin}
                  </span>
                ) : null}
              </p>
              <p className="text-sm text-muted-foreground">
                {text.since(day.format(new Date(player.joinedAt)))}
              </p>
            </div>
          </div>
          {player.isAdmin ? null : (
            <>
              <BlockForm playerId={player.id} blocked={player.blocked} />
              <DeletePlayerForm playerId={player.id} pseudo={player.pseudo} />
            </>
          )}
        </li>
      ))}
    </ul>
  );
}
