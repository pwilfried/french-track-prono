import Link from "next/link";

import { listDisciplines } from "@/application/disciplines";
import { UseCaseError, type ErrorCode } from "@/application/errors";
import { listAthletes } from "@/application/list-athletes";
import { ErrorNotice } from "@/components/error-notice";
import { ChipStatus } from "@/components/ui/chip-status";
import { flagOf } from "@/domain/flag";
import { missesCatalogueForMainDiscipline } from "@/domain/manager-catalogue";
import { filterAthletes, searchAthletes, type AthleteFilter } from "@/domain/start-list";
import type { Discipline } from "@/domain/discipline";
import { createSupabaseAthleteAdminRepository, createSupabaseDisciplineRepository } from "@/infra";

import { messages } from "../../messages.fr";
import { AdminShell } from "../competitions/admin-shell";
import { adminOnly } from "../guard";
import { createAthleteAction } from "./actions";

const field = "min-h-11 w-full rounded-xl border-2 border-border bg-background px-2.5 text-base";

export default async function AdminAthletesPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    discipline?: string;
    sexe?: string;
    pays?: string;
    erreur?: string;
  }>;
}) {
  const { client } = await adminOnly();
  const search = await searchParams;
  const q = (search.q ?? "").slice(0, 60);
  const filter: AthleteFilter = {
    discipline: search.discipline || undefined,
    gender: search.sexe === "F" || search.sexe === "M" ? search.sexe : undefined,
    country: search.pays?.slice(0, 3) || undefined,
  };
  const error =
    search.erreur && search.erreur in messages.errors
      ? messages.errors[search.erreur as ErrorCode]
      : null;
  let athletes;
  let disciplines: Discipline[] = [];
  try {
    [athletes, disciplines] = await Promise.all([
      listAthletes({ athletes: createSupabaseAthleteAdminRepository(client) }).execute(),
      listDisciplines({ disciplines: createSupabaseDisciplineRepository(client) }).execute(),
    ]);
  } catch (error) {
    if (!(error instanceof UseCaseError)) throw error;
    athletes = "error" as const;
  }
  const matching = athletes === "error" ? [] : searchAthletes(filterAthletes(athletes, filter), q);
  const shown = matching.slice(0, 50);
  const countries =
    athletes === "error" ? [] : [...new Set(athletes.map((a) => a.countryCode.trim()))].sort();

  return (
    <AdminShell title={messages.adminAthletes.title} section="athletes">
      {error && (
        <p
          role="alert"
          className="rounded-2xl bg-muted px-3.5 py-3 text-sm font-semibold text-accent-text"
        >
          {error}
        </p>
      )}
      <details className="rounded-card border border-border bg-card p-3.5" open={!!error}>
        <summary className="flex min-h-11 cursor-pointer items-center font-bold">
          {messages.adminAthletes.create}
        </summary>
        <form action={createAthleteAction} className="mt-2 flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm font-semibold">
            {messages.adminAthletes.name}
            <input name="name" required className={field} />
          </label>
          <div className="flex gap-3">
            <label className="flex flex-1 flex-col gap-1 text-sm font-semibold">
              {messages.import.country}
              <input
                name="countryCode"
                required
                maxLength={3}
                className={`${field} font-mono uppercase`}
              />
            </label>
            <label className="flex flex-1 flex-col gap-1 text-sm font-semibold">
              {messages.adminAthletes.gender}
              <select name="gender" defaultValue="F" className={field}>
                {(["F", "M", "X"] as const).map((g) => (
                  <option key={g} value={g}>
                    {messages.events.gender[g]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="flex flex-col gap-1 text-sm font-semibold">
            {messages.adminAthletes.mainDiscipline}
            <select name="discipline" required defaultValue="" className={field}>
              <option value="" disabled>
                {messages.adminAthletes.choose}
              </option>
              {disciplines.map((d) => (
                <option key={d.name} value={d.name}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            className="min-h-11 rounded-full bg-primary px-4 font-bold text-primary-foreground"
          >
            {messages.adminAthletes.createSubmit}
          </button>
        </form>
      </details>
      <form method="get" role="search" className="flex flex-col gap-2">
        <div className="flex gap-2">
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
        </div>
        <div className="grid grid-cols-3 gap-2">
          <label className="flex flex-col gap-1 text-xs font-semibold">
            {messages.adminAthletes.filterDiscipline}
            <select name="discipline" defaultValue={filter.discipline ?? ""} className={field}>
              <option value="">{messages.adminAthletes.all}</option>
              {disciplines.map((d) => (
                <option key={d.name} value={d.name}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold">
            {messages.adminAthletes.filterGender}
            <select name="sexe" defaultValue={filter.gender ?? ""} className={field}>
              <option value="">{messages.adminAthletes.all}</option>
              <option value="F">{messages.events.gender.F}</option>
              <option value="M">{messages.events.gender.M}</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold">
            {messages.adminAthletes.filterCountry}
            <select name="pays" defaultValue={filter.country ?? ""} className={field}>
              <option value="">{messages.adminAthletes.all}</option>
              {countries.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="text-sm text-muted-foreground">
          {messages.adminAthletes.found(matching.length)}
        </p>
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
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="break-words font-semibold">{a.name}</span>
                  {missesCatalogueForMainDiscipline(a) && (
                    <ChipStatus tone="gold" className="self-start whitespace-normal">
                      {messages.adminAthletes.offCatalogueNoMainDiscipline}
                    </ChipStatus>
                  )}
                </span>
                <span className="text-xs text-muted-foreground">
                  {a.countryCode} · {messages.events.gender[a.gender]}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </AdminShell>
  );
}
