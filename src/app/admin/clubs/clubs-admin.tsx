"use client";

import { useState } from "react";

import type { AdminClub } from "@/application/club-admin";
import { messages } from "@/app/messages.fr";
import {
  AdminList,
  type DetailContext,
  type ListColumn,
  type ListFeedback,
} from "@/components/admin/admin-list";
import { matchesClub } from "@/domain/club";

import {
  deleteClubsAction,
  mergeClubAction,
  updateClubAction,
  validateClubsAction,
  type ClubListResult,
} from "./actions";

const text = messages.adminClubs;

export type ClubRow = AdminClub & {
  addedLabel: string;
  duplicate: { id: string; name: string; city: string; department: string } | null;
};

const feedback = (result: ClubListResult, message: (count: number) => string): ListFeedback =>
  result.error ? { error: messages.errors[result.error] } : { message: message(result.count ?? 0) };

const field =
  "min-h-11 rounded-xl border-2 border-border bg-background px-2.5 text-base focus-visible:border-primary focus-visible:outline-none";

const pill = (validated: boolean) =>
  validated ? (
    <span className="rounded-full bg-success/15 px-2 py-0.5 text-xs font-bold text-success-text">
      {text.validated}
    </span>
  ) : (
    <span className="rounded-full bg-gold-soft px-2 py-0.5 text-xs font-bold text-gold-ink">
      {text.pending}
    </span>
  );

const columns: ListColumn<ClubRow>[] = [
  {
    key: "name",
    label: text.column.name,
    sort: (a, b) => a.name.localeCompare(b.name, "fr"),
    cell: (c) => (
      <span className="flex min-w-40 flex-col break-words">
        {c.name}
        {c.duplicate && (
          <span className="text-xs font-semibold text-accent-text">
            {text.likely(c.duplicate.name)}
          </span>
        )}
      </span>
    ),
  },
  { key: "city", label: text.column.city, cell: (c) => c.city },
  { key: "department", label: text.column.department, cell: (c) => c.department },
  { key: "origin", label: text.column.origin, cell: (c) => text.originShort[c.source] },
  {
    key: "players",
    label: text.column.players,
    numeric: true,
    sort: (a, b) => a.playerCount - b.playerCount,
    cell: (c) => text.players(c.playerCount),
  },
  {
    key: "added",
    label: text.column.added,
    sort: (a, b) => a.createdAt.localeCompare(b.createdAt),
    cell: (c) => c.addedLabel,
    hideOnCard: true,
  },
  { key: "status", label: text.column.status, cell: (c) => pill(c.validated) },
];

/** The back-office list of clubs (#381): filters, grouped actions, duplicates to merge. */
export function ClubsAdmin({ clubs }: { clubs: ClubRow[] }) {
  const departments = [...new Set(clubs.map((c) => c.department).filter(Boolean))].sort();
  return (
    <AdminList
      label={text.listLabel}
      items={clubs}
      getId={(c) => c.id}
      getLabel={(c) => c.name}
      columns={columns}
      searchText={(c) => `${c.name} ${c.city}`}
      searchLabel={text.searchLabel}
      searchPlaceholder={text.searchPlaceholder}
      filters={[
        { key: "pending", label: text.filter.pending, test: (c) => !c.validated },
        { key: "validated", label: text.filter.validated, test: (c) => c.validated },
        { key: "players", label: text.filter.withPlayers, test: (c) => c.playerCount > 0 },
      ]}
      defaultFilter={clubs.some((c) => !c.validated) ? "pending" : undefined}
      selects={[
        {
          key: "origin",
          label: text.origin,
          all: text.originAll,
          options: (["player", "import", "admin"] as const).map((s) => ({
            value: s,
            label: text.originShort[s],
          })),
          test: (c, value) => c.source === value,
        },
        {
          key: "department",
          label: text.department,
          all: text.departmentAll,
          options: departments.map((d) => ({ value: d, label: d })),
          test: (c, value) => c.department === value,
        },
      ]}
      bulkActions={[
        {
          key: "validate",
          label: text.validate,
          run: async (ids) => feedback(await validateClubsAction(ids), text.validatedCount),
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
          run: async (ids) => feedback(await deleteClubsAction(ids), text.removedCount),
        },
      ]}
      renderDetail={(club, context) => (
        <ClubDetail key={club.id} club={club} clubs={clubs} context={context} />
      )}
      pageSize={25}
    />
  );
}

function ClubDetail({
  club,
  clubs,
  context,
}: {
  club: ClubRow;
  clubs: ClubRow[];
  context: DetailContext;
}) {
  const [search, setSearch] = useState("");
  const others = search.trim()
    ? clubs.filter((c) => c.id !== club.id && matchesClub(search, c)).slice(0, 5)
    : [];
  const merge = (into: { id: string; name: string }) =>
    context.confirm(
      {
        title: text.mergeTitle(club.name, into.name),
        body: text.mergeBody,
        submit: text.mergeSubmit,
      },
      async () => {
        const result = await mergeClubAction(club.id, into.id);
        if (!result.error) context.close();
        return feedback(result, (n) => text.merged(into.name, n));
      },
    );

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        {text.added(club.addedLabel, text.source[club.source])} · {text.players(club.playerCount)}
      </p>

      {club.duplicate && (
        <section className="flex flex-col gap-2 rounded-2xl bg-gold-soft p-3.5 text-gold-ink">
          <h3 className="text-xs font-bold uppercase tracking-wide">{text.duplicate}</h3>
          <p className="font-semibold">
            {club.duplicate.name}
            {club.duplicate.city ? ` · ${club.duplicate.city}` : ""}
            {club.duplicate.department ? ` (${club.duplicate.department})` : ""}
          </p>
          <button
            type="button"
            onClick={() => merge(club.duplicate!)}
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-brand px-4 font-bold text-brand-foreground"
          >
            {text.mergeInto(club.duplicate.name)}
          </button>
          <p className="text-xs">{text.mergeHint}</p>
        </section>
      )}

      {/* Entrée enregistre : a plain form, read without a page reload. */}
      <form
        className="flex flex-col gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          const fields = {
            name: String(data.get("name") ?? ""),
            city: String(data.get("city") ?? ""),
            department: String(data.get("department") ?? ""),
          };
          void updateClubAction(club.id, fields).then((result) =>
            context.notify(feedback(result, () => text.saved)),
          );
        }}
      >
        <label className="flex flex-col gap-1 text-sm font-bold">
          {text.nameLabel}
          <input name="name" defaultValue={club.name} maxLength={120} className={field} />
        </label>
        <div className="grid grid-cols-[minmax(0,1fr)_5rem] gap-2">
          <label className="flex flex-col gap-1 text-sm font-bold">
            {text.cityLabel}
            <input name="city" defaultValue={club.city} maxLength={80} className={field} />
          </label>
          <label className="flex flex-col gap-1 text-sm font-bold">
            {text.departmentLabel}
            <input
              name="department"
              defaultValue={club.department}
              maxLength={3}
              className={field}
            />
          </label>
        </div>
        <button
          type="submit"
          className="inline-flex min-h-11 items-center justify-center rounded-full border-2 border-border font-bold"
        >
          {text.save}
        </button>
      </form>

      <div className="flex flex-wrap gap-2">
        {!club.validated && (
          <button
            type="button"
            onClick={async () =>
              context.notify(feedback(await validateClubsAction([club.id]), text.validatedCount))
            }
            className="inline-flex min-h-11 flex-1 items-center justify-center rounded-full bg-brand px-4 font-bold text-brand-foreground"
          >
            {text.validateAsIs}
          </button>
        )}
        <button
          type="button"
          onClick={() =>
            context.confirm(
              { title: text.removeTitle(1), body: text.removeBody, submit: text.removeSubmit },
              async () => {
                const result = await deleteClubsAction([club.id]);
                if (!result.error) context.close();
                return feedback(result, text.removedCount);
              },
            )
          }
          className="inline-flex min-h-11 items-center justify-center rounded-full border-2 border-border px-4 font-bold text-accent-text"
        >
          {text.removeOne}
        </button>
      </div>

      <details className="rounded-2xl border border-border p-3">
        <summary className="flex min-h-11 cursor-pointer items-center font-bold">
          {text.mergeOther}
        </summary>
        <label className="mt-2 flex flex-col gap-1 text-sm font-bold">
          {text.mergeSearch}
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className={field}
          />
        </label>
        <ul className="mt-2 flex flex-col gap-1">
          {others.map((other) => (
            <li key={other.id}>
              <button
                type="button"
                onClick={() => merge(other)}
                className="flex min-h-11 w-full flex-col items-start justify-center rounded-xl px-2 text-left hover:bg-brand-soft"
              >
                <span className="font-semibold">{other.name}</span>
                <span className="text-xs text-muted-foreground">
                  {[other.city, other.department, text.players(other.playerCount)]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
