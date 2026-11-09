import { UseCaseError } from "@/application/errors";
import { searchPlayers, type ModeratedPlayer } from "@/application/player-moderation";
import { ErrorNotice } from "@/components/error-notice";
import { createSupabasePlayerModerationRepository } from "@/infra";

import { messages } from "../../messages.fr";
import { paramText } from "../../search-params";
import { AdminShell } from "../competitions/admin-shell";
import { adminOnly } from "../guard";
import { PlayerList } from "./player-list";

const text = messages.adminPlayers;

/** Back-office « Joueurs » (#343): find a player by pseudo, block, unblock or delete them. */
export default async function AdminPlayersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { client } = await adminOnly();
  const query = (paramText((await searchParams).q) ?? "").trim();
  let players: ModeratedPlayer[] | "error" | null = null;
  if (query.length >= 2) {
    try {
      players = await searchPlayers({
        players: createSupabasePlayerModerationRepository(client),
      }).execute({ query });
    } catch (error) {
      if (!(error instanceof UseCaseError)) throw error;
      players = "error";
    }
  }

  return (
    <AdminShell title={text.title} section="players">
      <p className="text-sm text-muted-foreground">{text.subtitle}</p>
      <form role="search" action="/admin/joueurs" className="flex items-end gap-2">
        <label className="flex flex-1 flex-col gap-1.5">
          <span className="text-sm font-bold">{text.searchLabel}</span>
          <input
            type="search"
            name="q"
            defaultValue={query}
            minLength={2}
            maxLength={40}
            autoComplete="off"
            className="min-h-12 rounded-2xl border-2 border-border bg-card px-3.5 text-base focus-visible:border-primary focus-visible:outline-none"
          />
        </label>
        <button
          type="submit"
          className="min-h-12 rounded-2xl bg-primary px-4 font-bold text-primary-foreground"
        >
          {text.search}
        </button>
      </form>
      {players === null ? (
        <p className="text-sm text-muted-foreground">{text.hint}</p>
      ) : players === "error" ? (
        <ErrorNotice
          retryHref={`/admin/joueurs?q=${encodeURIComponent(query)}`}
          message={messages.errors.PLAYERS_UNAVAILABLE}
        />
      ) : players.length === 0 ? (
        <p className="rounded-card bg-muted p-4 text-sm text-muted-foreground">{text.empty}</p>
      ) : (
        <PlayerList players={players} />
      )}
    </AdminShell>
  );
}
