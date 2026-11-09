import { UseCaseError } from "@/application/errors";
import { listAdminPlayers, type AdminPlayer } from "@/application/player-moderation";
import { ErrorNotice } from "@/components/error-notice";
import { createSupabasePlayerModerationRepository } from "@/infra";

import { messages } from "../../messages.fr";
import { AdminShell } from "../competitions/admin-shell";
import { adminOnly } from "../guard";
import { PlayersAdmin, type PlayerRow } from "./players-admin";

const text = messages.adminPlayers;
const DAY = 24 * 60 * 60 * 1000;
const day = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Europe/Paris",
});

function activityLabel(now: number, iso: string): string {
  const days = Math.floor((now - Date.parse(iso)) / DAY);
  return days <= 0 ? text.today : days === 1 ? text.yesterday : text.daysAgo(days);
}

/** Back-office « Joueurs » (#343, #382): every player, what they do, block or delete. */
export default async function AdminPlayersPage() {
  const { client } = await adminOnly();
  let players: AdminPlayer[] | "error";
  try {
    players = await listAdminPlayers({
      players: createSupabasePlayerModerationRepository(client),
    }).execute();
  } catch (error) {
    if (!(error instanceof UseCaseError)) throw error;
    players = "error";
  }
  const now = new Date().getTime();
  const rows: PlayerRow[] =
    players === "error"
      ? []
      : players.map((player) => ({
          ...player,
          joinedLabel: day.format(new Date(player.joinedAt)),
          activityLabel: activityLabel(now, player.lastActiveAt),
          isNew: now - Date.parse(player.joinedAt) < 7 * DAY,
          isIdle: now - Date.parse(player.lastActiveAt) > 30 * DAY,
        }));
  const active = rows.filter((p) => now - Date.parse(p.lastActiveAt) < 7 * DAY).length;

  return (
    <AdminShell title={text.title} section="players" wide>
      <p className="text-sm text-muted-foreground">
        {players === "error"
          ? text.subtitle
          : text.summary(rows.length, active, rows.filter((p) => p.blocked).length)}
      </p>
      {players === "error" ? (
        <ErrorNotice retryHref="/admin/joueurs" message={messages.errors.PLAYERS_UNAVAILABLE} />
      ) : (
        <PlayersAdmin players={rows} />
      )}
    </AdminShell>
  );
}
