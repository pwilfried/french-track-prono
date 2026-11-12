"use client";

import { useEffect, useState } from "react";

import type { AdminLeague, AdminLeagueMember } from "@/application/league-moderation";
import { messages } from "@/app/messages.fr";
import {
  AdminList,
  type DetailContext,
  type ListColumn,
  type ListFeedback,
} from "@/components/admin/admin-list";
import { Bib } from "@/components/profile/bib";
import { leagueCapacity } from "@/domain/league";

import {
  deleteLeaguesAction,
  dismissReportsAction,
  leagueMembersAction,
  removeMemberAction,
  renameLeagueAction,
  type LeagueListResult,
} from "./actions";

const text = messages.adminLeagues;

export type LeagueRow = AdminLeague & { createdLabel: string };

const feedback = (result: LeagueListResult, message: (count: number) => string): ListFeedback =>
  result.error ? { error: messages.errors[result.error] } : { message: message(result.count ?? 0) };

const field =
  "min-h-11 rounded-xl border-2 border-border bg-background px-2.5 text-base focus-visible:border-primary focus-visible:outline-none";

/** How full a league is: a bar under its member count. */
function Fill({ league }: { league: LeagueRow }) {
  const capacity = leagueCapacity(league.isPublic);
  return (
    <span className="flex min-w-28 flex-col gap-1">
      {text.members(league.memberCount, capacity)}
      <span aria-hidden="true" className="h-1.5 rounded-full bg-muted">
        <span
          className="block h-1.5 rounded-full bg-brand"
          style={{ width: `${Math.min(100, (league.memberCount / capacity) * 100)}%` }}
        />
      </span>
    </span>
  );
}

const kind = (league: LeagueRow) =>
  league.isPublic ? (
    <span className="rounded-full bg-brand-soft px-2 py-0.5 text-xs font-bold text-brand-ink">
      {text.public}
    </span>
  ) : (
    <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-bold">{text.private}</span>
  );

const columns: ListColumn<LeagueRow>[] = [
  {
    key: "name",
    label: text.column.name,
    sort: (a, b) => a.name.localeCompare(b.name, "fr"),
    cell: (l) => (
      <span className="inline-flex items-center gap-2 break-words">
        <span aria-hidden="true">{l.emoji}</span>
        {l.name}
      </span>
    ),
  },
  { key: "kind", label: text.column.kind, cell: kind },
  { key: "owner", label: text.column.owner, cell: (l) => l.owner ?? text.noOwner },
  {
    key: "members",
    label: text.column.members,
    sort: (a, b) => a.memberCount - b.memberCount,
    cell: (l) => <Fill league={l} />,
  },
  {
    key: "reports",
    label: text.column.reports,
    sort: (a, b) => a.reportCount - b.reportCount,
    cell: (l) =>
      l.reportCount > 0 ? (
        <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-bold text-accent-text">
          {text.reports(l.reportCount)}
        </span>
      ) : (
        text.noReport
      ),
  },
  {
    key: "created",
    label: text.column.created,
    sort: (a, b) => a.createdAt.localeCompare(b.createdAt),
    cell: (l) => l.createdLabel,
    hideOnCard: true,
  },
];

/** The back-office list of leagues (#383): every league, the reported ones first. */
export function LeaguesAdmin({ leagues }: { leagues: LeagueRow[] }) {
  return (
    <AdminList
      label={text.listLabel}
      items={leagues}
      getId={(l) => l.id}
      getLabel={(l) => l.name}
      columns={columns}
      searchText={(l) => `${l.name} ${l.owner ?? ""}`}
      searchLabel={text.searchLabel}
      searchPlaceholder={text.searchPlaceholder}
      filters={[
        { key: "all", label: text.filter.all, test: () => true },
        { key: "reported", label: text.filter.reported, test: (l) => l.reportCount > 0 },
        { key: "public", label: text.filter.public, test: (l) => l.isPublic },
        { key: "private", label: text.filter.private, test: (l) => !l.isPublic },
        { key: "empty", label: text.filter.empty, test: (l) => l.memberCount <= 1 },
      ]}
      defaultFilter={leagues.some((l) => l.reportCount > 0) ? "reported" : "all"}
      bulkActions={[
        {
          key: "dismiss",
          label: text.dismissMany,
          run: async (ids) => feedback(await dismissReportsAction(ids), text.dismissedCount),
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
          run: async (ids) => feedback(await deleteLeaguesAction(ids), text.removedCount),
        },
      ]}
      renderDetail={(league, context) => (
        <LeagueSheet key={league.id} league={league} context={context} />
      )}
      pageSize={25}
    />
  );
}

function LeagueSheet({ league, context }: { league: LeagueRow; context: DetailContext }) {
  const [members, setMembers] = useState<AdminLeagueMember[] | "loading" | "error">("loading");
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let live = true;
    void leagueMembersAction(league.id).then((result) => {
      if (live) setMembers(result.members ?? "error");
    });
    return () => {
      live = false;
    };
  }, [league.id, version]);

  const remove = () =>
    context.confirm(
      { title: text.removeTitle(1, league.name), body: text.removeBody, submit: text.removeSubmit },
      async () => {
        const result = await deleteLeaguesAction([league.id]);
        if (!result.error) context.close();
        return feedback(result, text.removedCount);
      },
    );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        {kind(league)}
        <span>{text.created(league.createdLabel, league.owner ?? text.noOwner)}</span>
      </div>
      <Fill league={league} />

      {league.reportCount > 0 && (
        <section className="flex flex-col gap-2 rounded-2xl border-2 border-primary/40 p-3.5">
          <h3 className="text-sm font-bold text-accent-text">
            {text.moderationTitle(league.reportCount)}
          </h3>
          {/* Entrée renames. */}
          <form
            className="flex flex-col gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              const name = String(new FormData(event.currentTarget).get("name") ?? "");
              void renameLeagueAction(league.id, name).then((result) =>
                context.notify(feedback(result, () => text.renamed)),
              );
            }}
          >
            <label className="flex flex-col gap-1 text-sm font-bold">
              {text.renameLabel}
              <input name="name" defaultValue={league.name} maxLength={40} className={field} />
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                className="inline-flex min-h-11 flex-1 items-center justify-center rounded-full bg-brand px-4 font-bold text-brand-foreground"
              >
                {text.rename}
              </button>
              <button
                type="button"
                onClick={async () =>
                  context.notify(
                    feedback(await dismissReportsAction([league.id]), () => text.dismissed),
                  )
                }
                className="inline-flex min-h-11 items-center justify-center rounded-full border-2 border-border px-4 font-bold"
              >
                {text.dismiss}
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="flex flex-col gap-1.5">
        <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
          {text.competitions}
        </h3>
        <p className="text-sm">
          {league.competitions.length ? league.competitions.join(" · ") : text.noCompetition}
        </p>
      </section>

      <section className="flex flex-col gap-1.5">
        <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
          {text.membersTitle}
        </h3>
        {members === "loading" ? (
          <p role="status" className="text-sm text-muted-foreground">
            {text.membersLoading}
          </p>
        ) : members === "error" ? (
          <p role="alert" className="text-sm text-accent-text">
            {messages.errors.LEAGUES_UNAVAILABLE}
          </p>
        ) : (
          <ol aria-label={text.membersTitle} className="flex flex-col gap-1">
            {members.map((member) => (
              <li key={member.userId} className="flex min-h-11 items-center gap-2 text-sm">
                <span className="w-9 font-mono font-bold">{text.rank(member.rank)}</span>
                <Bib bib={member.bib} />
                <span className="min-w-0 flex-1 break-words font-semibold">
                  {member.pseudo}
                  {member.isOwner && (
                    <span className="ml-2 text-xs font-bold text-muted-foreground">
                      {text.owner}
                    </span>
                  )}
                </span>
                <span className="whitespace-nowrap font-mono">{text.points(member.points)}</span>
                {!member.isOwner && (
                  <button
                    type="button"
                    aria-label={text.removeMember(member.pseudo)}
                    onClick={() =>
                      context.confirm(
                        {
                          title: text.removeMemberTitle(member.pseudo),
                          body: text.removeMemberBody,
                          submit: text.removeMemberSubmit,
                        },
                        async () => {
                          const result = await removeMemberAction(league.id, member.userId);
                          setVersion((v) => v + 1);
                          return feedback(result, () => text.memberRemoved);
                        },
                      )
                    }
                    className="inline-flex size-11 shrink-0 items-center justify-center rounded-full border-2 border-border font-bold text-accent-text"
                  >
                    ✕
                  </button>
                )}
              </li>
            ))}
          </ol>
        )}
      </section>

      <button
        type="button"
        onClick={remove}
        className="inline-flex min-h-11 items-center justify-center rounded-full border-2 border-border px-4 font-bold text-accent-text"
      >
        {text.remove}
      </button>
    </div>
  );
}
