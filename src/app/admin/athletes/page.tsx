import Link from "next/link";

import { UseCaseError } from "@/application/errors";
import { listAthletes } from "@/application/list-athletes";
import { ErrorNotice } from "@/components/error-notice";
import { flagOf } from "@/domain/flag";
import { searchAthletes } from "@/domain/start-list";
import { createSupabaseAthleteAdminRepository } from "@/infra";

import { messages } from "../../messages.fr";
import { adminOnly } from "../guard";

export default async function AdminAthletesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { client } = await adminOnly();
  const q = ((await searchParams).q ?? "").slice(0, 60);
  let athletes;
  try {
    athletes = await listAthletes({
      athletes: createSupabaseAthleteAdminRepository(client),
    }).execute();
  } catch (error) {
    if (!(error instanceof UseCaseError)) throw error;
    athletes = "error" as const;
  }
  const shown = athletes === "error" ? [] : searchAthletes(athletes, q).slice(0, 50);

  return (
    <main id="main" className="flex flex-1 flex-col">
      <p
        role="note"
        className="bg-primary px-4 py-1 text-center text-[11px] font-extrabold uppercase tracking-[0.14em] text-primary-foreground"
      >
        {messages.admin.band}
      </p>
      <header className="px-4 pt-4">
        <div className="mx-auto max-w-md">
          <Link
            href="/admin"
            className="inline-flex min-h-11 items-center font-semibold text-brand dark:text-secondary"
          >
            ‹ {messages.admin.back}
          </Link>
          <h1 className="mt-1 font-display text-3xl font-extrabold leading-none">
            {messages.adminAthletes.title}
          </h1>
        </div>
      </header>
      <div className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 py-5">
        <form method="get" role="search" className="flex gap-2">
          <label htmlFor="athlete-q" className="sr-only">
            {messages.startList.search}
          </label>
          <input
            id="athlete-q"
            type="search"
            name="q"
            defaultValue={q}
            placeholder={messages.startList.search}
            className="min-h-12 flex-1 rounded-xl border-2 border-border bg-card px-3.5 text-base"
          />
          <button
            type="submit"
            className="min-h-12 rounded-full bg-primary px-5 font-bold text-primary-foreground"
          >
            {messages.adminLog.apply}
          </button>
        </form>
        {athletes === "error" ? (
          <ErrorNotice retryHref="/admin/athletes" message={messages.errors.ATHLETES_UNAVAILABLE} />
        ) : shown.length === 0 ? (
          <p className="rounded-card bg-muted p-4">{messages.startList.noMatch}</p>
        ) : (
          <ul aria-label={messages.adminAthletes.title} className="flex flex-col">
            {shown.map((a) => (
              <li key={a.athleteId} className="border-b border-border">
                <Link
                  href={`/admin/athletes/${a.slug}`}
                  className="flex min-h-12 items-center gap-3 py-2"
                >
                  <span aria-hidden="true">{flagOf(a.countryCode)}</span>
                  <span className="min-w-0 flex-1 break-words font-semibold">{a.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {a.countryCode} · {messages.events.gender[a.gender]}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
