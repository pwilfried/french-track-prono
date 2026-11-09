"use client";

import { useEffect, useState } from "react";

import type { AdminPlayer, PlayerLeague } from "@/application/player-moderation";
import { messages } from "@/app/messages.fr";
import {
  AdminList,
  type DetailContext,
  type ListColumn,
  type ListFeedback,
} from "@/components/admin/admin-list";

import {
  deletePlayersAction,
  playerLeaguesAction,
  setBlockedAction,
  type PlayerListResult,
} from "./actions";

const text = messages.adminPlayers;

export type PlayerRow = AdminPlayer & {
  joinedLabel: string;
  activityLabel: string;
  isNew: boolean;
  isIdle: boolean;
};

const feedback = (
  result: PlayerListResult,
  message: (count: number) => string,
  undo?: () => Promise<unknown>,
): ListFeedback =>
  result.error
    ? { error: messages.errors[result.error] }
    : {
        message: message(result.count ?? 0),
        undo: undo ? async () => void (await undo()) : undefined,
      };

const columns: ListColumn<PlayerRow>[] = [
  {
    key: "player",
    label: text.column.player,
    sort: (a, b) => a.pseudo.localeCompare(b.pseudo, "fr"),
    cell: (p) => (
      <span className="inline-flex items-center gap-2">
        <span aria-hidden="true">{p.avatar}</span>
        <span className="break-words">{p.pseudo}</span>
        {p.blocked && (
          <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-bold text-accent-text">
            {text.blocked}
          </span>
        )}
        {p.isAdmin && (
          <span className="rounded-full bg-brand-soft px-2 py-0.5 text-xs font-bold text-brand-ink">
            {text.admin}
          </span>
        )}
      </span>
    ),
  },
  { key: "club", label: text.column.club, cell: (p) => p.club ?? text.noClub },
  {
    key: "points",
    label: text.column.points,
    numeric: true,
    sort: (a, b) => a.points - b.points,
    cell: (p) => text.points(p.points),
  },
  {
    key: "predictions",
    label: text.column.predictions,
    numeric: true,
    cell: (p) => text.predictions(p.predictions),
  },
  {
    key: "leagues",
    label: text.column.leagues,
    numeric: true,
    cell: (p) => p.leagues,
    hideOnCard: true,
  },
  {
    key: "activity",
    label: text.column.activity,
    sort: (a, b) => a.lastActiveAt.localeCompare(b.lastActiveAt),
    cell: (p) => p.activityLabel,
  },
  {
    key: "joined",
    label: text.column.joined,
    sort: (a, b) => a.joinedAt.localeCompare(b.joinedAt),
    cell: (p) => p.joinedLabel,
    hideOnCard: true,
  },
];

/** The back-office list of players (#382): filters, the player's sheet, block and delete. */
export function PlayersAdmin({ players }: { players: PlayerRow[] }) {
  const clubs = [...new Set(players.map((p) => p.club).filter((c): c is string => !!c))].sort(
    (a, b) => a.localeCompare(b, "fr"),
  );
  const notAdmin = (ids: string[]) =>
    ids.filter((id) => !players.find((p) => p.id === id)?.isAdmin);
  return (
    <AdminList
      label={text.listLabel}
      items={players}
      getId={(p) => p.id}
      getLabel={(p) => p.pseudo}
      columns={columns}
      searchText={(p) => p.pseudo}
      searchLabel={text.searchLabel}
      searchPlaceholder={text.searchPlaceholder}
      filters={[
        { key: "all", label: text.filter.all, test: () => true },
        { key: "new", label: text.filter.fresh, test: (p) => p.isNew },
        { key: "idle", label: text.filter.idle, test: (p) => p.isIdle },
        { key: "none", label: text.filter.noPrediction, test: (p) => p.predictions === 0 },
        { key: "blocked", label: text.filter.blocked, test: (p) => p.blocked },
      ]}
      defaultFilter="all"
      selects={[
        {
          key: "club",
          label: text.club,
          all: text.clubAll,
          options: clubs.map((c) => ({ value: c, label: c })),
          test: (p, club) => p.club === club,
        },
      ]}
      bulkActions={[
        {
          key: "block",
          label: text.block,
          run: async (ids) => {
            const targets = notAdmin(ids);
            return feedback(await setBlockedAction(targets, true), text.blockedCount, () =>
              setBlockedAction(targets, false),
            );
          },
        },
        {
          key: "delete",
          label: text.removeMany,
          danger: true,
          confirm: (count) => ({
            title: text.removeTitle(count),
            body: text.removeBody,
            submit: text.removeSubmit,
          }),
          run: async (ids) => feedback(await deletePlayersAction(notAdmin(ids)), text.removedCount),
        },
      ]}
      renderDetail={(player, context) => (
        <PlayerSheet key={player.id} player={player} context={context} />
      )}
      pageSize={25}
    />
  );
}

function PlayerSheet({ player, context }: { player: PlayerRow; context: DetailContext }) {
  const [leagues, setLeagues] = useState<PlayerLeague[] | "loading" | "error">("loading");
  useEffect(() => {
    let live = true;
    void playerLeaguesAction(player.id).then((result) => {
      if (live) setLeagues(result.leagues ?? "error");
    });
    return () => {
      live = false;
    };
  }, [player.id]);

  const stats = [
    [player.rank ? `#${player.rank}` : text.notRanked, text.stat.rank],
    [String(player.predictions), text.stat.predictions],
    [String(player.leagues), text.stat.leagues],
  ];
  const toggle = async () => {
    const result = await setBlockedAction([player.id], !player.blocked);
    context.notify(
      feedback(result, player.blocked ? text.unblockedCount : text.blockedCount, () =>
        setBlockedAction([player.id], player.blocked),
      ),
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        <span aria-hidden="true" className="mr-1">
          {player.avatar}
        </span>
        {text.since(player.joinedLabel)} · {player.club ?? text.noClub}
      </p>
      <dl className="grid grid-cols-3 gap-2">
        {stats.map(([value, label]) => (
          <div key={label} className="flex flex-col items-center rounded-2xl bg-muted p-3">
            <dd className="font-mono text-2xl font-bold">{value}</dd>
            <dt className="text-xs text-muted-foreground">{label}</dt>
          </div>
        ))}
      </dl>
      <section className="flex flex-col gap-1.5">
        <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
          {text.leaguesTitle}
        </h3>
        {leagues === "loading" ? (
          <p role="status" className="text-sm text-muted-foreground">
            {text.leaguesLoading}
          </p>
        ) : leagues === "error" ? (
          <p role="alert" className="text-sm text-accent-text">
            {messages.errors.PLAYERS_UNAVAILABLE}
          </p>
        ) : leagues.length === 0 ? (
          <p className="text-sm text-muted-foreground">{text.noLeague}</p>
        ) : (
          <ul className="flex flex-col gap-1 text-sm">
            {leagues.map((l) => (
              <li key={l.id}>{text.leagueRank(l.name, l.rank, l.memberCount)}</li>
            ))}
          </ul>
        )}
      </section>
      <section className="flex flex-col gap-1.5">
        <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
          {text.reportsTitle}
        </h3>
        <p className="text-sm">{text.reports(player.reports)}</p>
      </section>
      {player.isAdmin ? (
        <p className="text-sm text-muted-foreground">{text.adminNote}</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={toggle}
            className="inline-flex min-h-11 flex-1 items-center justify-center rounded-full bg-brand px-4 font-bold text-brand-foreground"
          >
            {player.blocked ? text.unblock : text.block}
          </button>
          <button
            type="button"
            onClick={() =>
              context.confirm(
                {
                  title: text.removeTitle(1, player.pseudo),
                  body: text.removeBody,
                  submit: text.removeSubmit,
                },
                async () => {
                  const result = await deletePlayersAction([player.id]);
                  if (!result.error) context.close();
                  return feedback(result, text.removedCount);
                },
              )
            }
            className="inline-flex min-h-11 items-center justify-center rounded-full border-2 border-border px-4 font-bold text-accent-text"
          >
            {text.remove}
          </button>
        </div>
      )}
    </div>
  );
}
