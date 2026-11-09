import Link from "next/link";

import { UseCaseError } from "@/application/errors";
import { listAdminActions, type AdminLogFilter } from "@/application/list-admin-actions";
import { ErrorNotice } from "@/components/error-notice";
import { buttonVariants } from "@/components/ui/button";
import { createSupabaseAdminLogRepository } from "@/infra";

import { currentCompetition } from "../../competition";
import { messages } from "../../messages.fr";
import { AdminShell } from "../competitions/admin-shell";
import { adminOnly } from "../guard";

type Search = { admin?: string; epreuve?: string; depuis?: string };

/** Only well-formed values reach the query: an id is a UUID, a date is YYYY-MM-DD. */
function filterOf(search: Search): AdminLogFilter {
  const uuid = /^[0-9a-f-]{36}$/i;
  return {
    adminId: search.admin && uuid.test(search.admin) ? search.admin : undefined,
    eventId: search.epreuve && uuid.test(search.epreuve) ? search.epreuve : undefined,
    since: search.depuis && /^\d{4}-\d{2}-\d{2}$/.test(search.depuis) ? search.depuis : undefined,
  };
}

const field = "min-h-11 w-full rounded-xl border-2 border-border bg-card px-3 text-base";

export default async function AdminLogPage({ searchParams }: { searchParams: Promise<Search> }) {
  // The admin check first: it reads the session, so the page is never built ahead.
  const { client } = await adminOnly();
  const competition = await currentCompetition();
  const filter = filterOf(await searchParams);
  let page;
  try {
    page = await listAdminActions({ log: createSupabaseAdminLogRepository(client) }).execute({
      filter,
    });
  } catch (error) {
    if (!(error instanceof UseCaseError)) throw error;
    page = "error" as const;
  }
  const time = new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: competition.timeZone,
  });

  return (
    <AdminShell title={messages.adminLog.title} section="history">
      <p className="text-sm text-muted-foreground">{messages.adminLog.subtitle}</p>
      {page === "error" ? (
        <ErrorNotice
          retryHref="/admin/historique"
          message={messages.errors.ADMIN_LOG_UNAVAILABLE}
        />
      ) : (
        <>
          <form
            method="get"
            aria-label={messages.adminLog.filters}
            className="flex flex-col gap-3 rounded-card border border-border bg-card p-3.5"
          >
            <label className="flex flex-col gap-1 text-sm font-semibold">
              {messages.adminLog.admin}
              <select name="admin" defaultValue={filter.adminId ?? ""} className={field}>
                <option value="">{messages.adminLog.allAdmins}</option>
                {page.admins.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.pseudo}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm font-semibold">
              {messages.adminLog.event}
              <select name="epreuve" defaultValue={filter.eventId ?? ""} className={field}>
                <option value="">{messages.adminLog.allEvents}</option>
                {page.events.map((e) => (
                  <option key={e.id} value={e.id}>
                    {messages.events.name(e.discipline, e.gender)}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm font-semibold">
              {messages.adminLog.since}
              <input
                type="date"
                name="depuis"
                defaultValue={filter.since ?? ""}
                className={field}
              />
            </label>
            <div className="flex gap-2">
              <button type="submit" className={`${buttonVariants({})} flex-1`}>
                {messages.adminLog.apply}
              </button>
              <Link
                href="/admin/historique"
                className={`${buttonVariants({ variant: "muted" })} flex-1`}
              >
                {messages.adminLog.clear}
              </Link>
            </div>
          </form>
          {page.actions.length === 0 ? (
            <p className="rounded-card bg-muted p-4">{messages.adminLog.empty}</p>
          ) : (
            <ol aria-label={messages.adminLog.lines} className="flex flex-col">
              {page.actions.map((a) => (
                <li key={a.id} className="flex flex-col gap-0.5 border-b border-border py-3">
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="font-bold">{messages.adminLog.kind[a.kind]}</span>
                    <time
                      dateTime={a.at}
                      className="shrink-0 font-mono text-xs text-muted-foreground"
                    >
                      {time.format(new Date(a.at))}
                    </time>
                  </span>
                  <span className="break-words text-sm">
                    {a.event ? (
                      <Link href={`/admin/${a.event.slug}`} className="font-semibold underline">
                        {messages.events.name(a.event.discipline, a.event.gender)}
                      </Link>
                    ) : (
                      messages.adminLog.noEvent
                    )}
                    {" · "}
                    {messages.adminLog.size(a.kind, a.size)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {messages.adminLog.by(a.admin?.pseudo ?? null)}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </>
      )}
    </AdminShell>
  );
}
