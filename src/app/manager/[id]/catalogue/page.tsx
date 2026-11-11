import Link from "next/link";
import { notFound } from "next/navigation";

import { UseCaseError } from "@/application/errors";
import { browseManagerCatalogue } from "@/application/manager-catalogue";
import { ErrorNotice } from "@/components/error-notice";
import { LeagueHero } from "@/components/leagues/league-hero";
import { CatalogueCard } from "@/components/manager/catalogue-card";
import { buttonVariants } from "@/components/ui/button";
import type { ListView } from "@/domain/list-view";
import type { CatalogueAthlete } from "@/domain/manager-catalogue";
import { MANAGER_FAMILIES, MANAGER_SEXES, type ManagerSex } from "@/domain/manager-rules";
import { createSupabaseManagerCatalogue } from "@/infra";

import { messages } from "../../../messages.fr";
import { getSessionClient } from "../../../session";
import { managerPorts } from "../../data";

const text = messages.catalogue;
const field = "min-h-11 w-full rounded-xl border-2 border-border bg-card px-2.5 text-base";

type Params = { q?: string; sexe?: string; famille?: string; libres?: string; page?: string };

/**
 * The mercato catalogue of a league (#421): search and filters in the address, so they work
 * without script and survive a reload; a page of 30 athletes at a time.
 */
export default async function CataloguePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Params>;
}) {
  const { id } = await params;
  const search = await searchParams;
  await managerPorts(`/manager/${id}/catalogue`);
  const sex = MANAGER_SEXES.includes(search.sexe as ManagerSex)
    ? (search.sexe as ManagerSex)
    : null;
  const family = MANAGER_FAMILIES.find((f) => f === search.famille) ?? null;
  const availableOnly = search.libres === "1";
  const query = search.q ?? "";

  let view: ListView<CatalogueAthlete> | "error";
  try {
    view = await browseManagerCatalogue({
      catalogue: createSupabaseManagerCatalogue(await getSessionClient()),
    }).execute({
      leagueId: id,
      query,
      filter: { sex, family, availableOnly },
      page: Number(search.page) || 1,
    });
  } catch (error) {
    if (!(error instanceof UseCaseError)) throw error;
    if (error.code === "LEAGUE_NOT_FOUND") notFound();
    view = "error";
  }

  const pageHref = (page: number) =>
    `?${new URLSearchParams({
      ...(query && { q: query }),
      ...(sex && { sexe: sex }),
      ...(family && { famille: family }),
      ...(availableOnly && { libres: "1" }),
      page: String(page),
    })}`;
  const filtered = Boolean(query || sex || family || availableOnly);

  return (
    <main id="main" className="flex flex-1 flex-col">
      <LeagueHero
        title={text.title}
        subtitle={text.subtitle}
        back={{ href: `/manager/${id}`, label: messages.manager.back }}
      />
      <div className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 py-6 md:max-w-3xl">
        <form className="flex flex-col gap-3 rounded-card border border-border bg-card p-3.5">
          <label className="flex flex-col gap-1 text-sm font-semibold">
            {text.search}
            <input
              type="search"
              name="q"
              defaultValue={query}
              placeholder={text.searchPlaceholder}
              className={field}
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-sm font-semibold">
              {text.sex}
              <select name="sexe" defaultValue={sex ?? ""} className={field}>
                <option value="">{text.allSexes}</option>
                {MANAGER_SEXES.map((s) => (
                  <option key={s} value={s}>
                    {text.sexes[s]}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm font-semibold">
              {text.family}
              <select name="famille" defaultValue={family ?? ""} className={field}>
                <option value="">{text.all}</option>
                {MANAGER_FAMILIES.map((f) => (
                  <option key={f} value={f}>
                    {messages.disciplines.family[f]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-semibold">
            <input
              type="checkbox"
              name="libres"
              value="1"
              defaultChecked={availableOnly}
              className="size-6 shrink-0 accent-primary"
            />
            {text.availableOnly}
          </label>
          <button type="submit" className={`${buttonVariants({ variant: "muted" })} w-full`}>
            {text.apply}
          </button>
        </form>

        {view === "error" ? (
          <ErrorNotice
            retryHref={`/manager/${id}/catalogue`}
            message={messages.errors.CATALOGUE_UNAVAILABLE}
          />
        ) : (
          <>
            <p role="status" className="text-sm font-semibold text-muted-foreground">
              {text.found(view.total)}
            </p>
            {view.total === 0 ? (
              <p className="rounded-card bg-muted p-4 text-sm text-muted-foreground">
                {filtered ? text.empty : text.emptyCatalogue}
              </p>
            ) : (
              <ul aria-label={text.title} className="grid gap-2 md:grid-cols-2">
                {view.rows.map((athlete) => (
                  <li key={athlete.athleteId}>
                    <CatalogueCard athlete={athlete} />
                  </li>
                ))}
              </ul>
            )}
            {view.pageCount > 1 && (
              <nav className="flex items-center justify-between gap-2 text-sm font-semibold">
                {view.page > 1 ? (
                  <Link
                    href={pageHref(view.page - 1)}
                    className="inline-flex min-h-11 items-center"
                  >
                    {text.previous}
                  </Link>
                ) : (
                  <span />
                )}
                <span>{text.page(view.page, view.pageCount)}</span>
                {view.page < view.pageCount ? (
                  <Link
                    href={pageHref(view.page + 1)}
                    className="inline-flex min-h-11 items-center"
                  >
                    {text.next}
                  </Link>
                ) : (
                  <span />
                )}
              </nav>
            )}
          </>
        )}
      </div>
    </main>
  );
}
